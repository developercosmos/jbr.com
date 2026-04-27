/**
 * TECH-01: Background job queue.
 *
 * Two adapters share the same `JobAdapter` interface:
 *
 *   - InProcessQueue (default): runs handlers synchronously in the request
 *     handler. Used in dev or when Redis is unavailable.
 *   - BullMQAdapter: enqueues to Redis-backed BullMQ. Workers spawn in the
 *     same Node process via `startWorkers()` (called once at boot below).
 *
 * Selection is via env:
 *   QUEUE_DRIVER=bullmq      → use BullMQ
 *   REDIS_URL=redis://host:6379  (required for BullMQ)
 *
 * Without those vars, the InProcessQueue keeps the previous synchronous
 * semantics so call sites do not need to change.
 */

import { logger } from "@/lib/logger";
import type { Queue, Worker } from "bullmq";

export type JobName =
    | "send-email"
    | "recompute-seller-rating"
    | "image-resize"
    | "search-index"
    | "webhook-retry";

export interface JobAdapter {
    enqueue<T>(name: JobName, payload: T): Promise<void>;
    register<T>(name: JobName, handler: (payload: T) => Promise<void>): void;
}

class InProcessQueue implements JobAdapter {
    private handlers = new Map<JobName, (payload: unknown) => Promise<void>>();

    async enqueue<T>(name: JobName, payload: T): Promise<void> {
        const handler = this.handlers.get(name);
        if (!handler) {
            logger.warn("queue:no_handler", { name, driver: "in-process" });
            return;
        }
        try {
            await handler(payload);
        } catch (error) {
            logger.error("queue:job_failed", {
                name,
                driver: "in-process",
                error: String(error),
            });
        }
    }

    register<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
        this.handlers.set(name, handler as (payload: unknown) => Promise<void>);
    }
}

class BullMQAdapter implements JobAdapter {
    private queues = new Map<JobName, Queue>();
    private workers = new Map<JobName, Worker>();
    private connection: import("ioredis").Redis | null = null;
    private booted = false;

    constructor(private redisUrl: string) {}

    private async ensureConnection() {
        if (this.connection) return this.connection;
        const { default: Redis } = await import("ioredis");
        this.connection = new Redis(this.redisUrl, {
            maxRetriesPerRequest: null,
        });
        this.connection.on("error", (err) => {
            logger.error("queue:redis_error", { error: String(err) });
        });
        return this.connection;
    }

    private async getQueue(name: JobName): Promise<Queue> {
        const existing = this.queues.get(name);
        if (existing) return existing;
        const conn = await this.ensureConnection();
        const { Queue: BullQueue } = await import("bullmq");
        const q = new BullQueue(name, { connection: conn });
        this.queues.set(name, q);
        return q;
    }

    async enqueue<T>(name: JobName, payload: T): Promise<void> {
        try {
            const q = await this.getQueue(name);
            await q.add(name, payload as object, {
                attempts: 3,
                backoff: { type: "exponential", delay: 5_000 },
                removeOnComplete: { count: 1000, age: 24 * 60 * 60 },
                removeOnFail: { count: 5000 },
            });
        } catch (error) {
            logger.error("queue:enqueue_failed", { name, error: String(error) });
        }
    }

    register<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
        if (this.workers.has(name)) return;
        // Worker creation is async; register lazily on first call so we don't
        // block module load. Subsequent calls reuse the same worker.
        void this.createWorker(name, handler);
    }

    private async createWorker<T>(name: JobName, handler: (payload: T) => Promise<void>) {
        try {
            const conn = await this.ensureConnection();
            const { Worker: BullWorker } = await import("bullmq");
            const worker = new BullWorker(
                name,
                async (job) => {
                    await handler(job.data as T);
                },
                {
                    connection: conn,
                    concurrency: Number(process.env.QUEUE_CONCURRENCY || 5),
                }
            );
            worker.on("failed", (job, err) => {
                logger.error("queue:job_failed", {
                    name,
                    driver: "bullmq",
                    jobId: job?.id,
                    attempt: job?.attemptsMade,
                    error: String(err),
                });
            });
            worker.on("completed", (job) => {
                logger.info("queue:job_completed", {
                    name,
                    driver: "bullmq",
                    jobId: job.id,
                });
            });
            this.workers.set(name, worker);
        } catch (error) {
            logger.error("queue:worker_create_failed", { name, error: String(error) });
        }
    }

    markBooted() {
        this.booted = true;
    }

    isBooted() {
        return this.booted;
    }
}

let singleton: JobAdapter | null = null;

export function getQueue(): JobAdapter {
    if (!singleton) {
        const driver = process.env.QUEUE_DRIVER;
        const redisUrl = process.env.REDIS_URL;
        if (driver === "bullmq" && redisUrl) {
            const adapter = new BullMQAdapter(redisUrl);
            singleton = adapter;
            logger.info("queue:driver_selected", { driver: "bullmq", redisUrl: redactUrl(redisUrl) });
        } else {
            singleton = new InProcessQueue();
            if (driver === "bullmq") {
                logger.warn("queue:bullmq_missing_redis_url", {});
            }
        }
    }
    return singleton;
}

function redactUrl(url: string): string {
    try {
        const u = new URL(url);
        if (u.password) u.password = "***";
        return u.toString();
    } catch {
        return "<unparseable>";
    }
}

export async function enqueue<T>(name: JobName, payload: T): Promise<void> {
    return getQueue().enqueue(name, payload);
}

export function registerJob<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
    getQueue().register(name, handler);
}
