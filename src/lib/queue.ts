/**
 * TECH-01: Background job queue interface.
 *
 * Currently runs jobs synchronously in-process. Designed to be swapped for a
 * BullMQ + Redis backend without changing call sites:
 *
 *   import { enqueue } from "@/lib/queue";
 *   await enqueue("send-email", { to, template, data });
 *
 * To upgrade: implement `BullMQAdapter` against the same `JobAdapter` interface
 * and toggle via env (`QUEUE_DRIVER=bullmq`). See infra TODO at the bottom.
 */

import { logger } from "@/lib/logger";

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
            logger.warn("queue:no_handler", { name });
            return;
        }
        try {
            await handler(payload);
        } catch (error) {
            logger.error("queue:job_failed", { name, error: String(error) });
        }
    }

    register<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
        this.handlers.set(name, handler as (payload: unknown) => Promise<void>);
    }
}

let singleton: JobAdapter | null = null;

export function getQueue(): JobAdapter {
    if (!singleton) {
        // INFRA TODO (TECH-01): when QUEUE_DRIVER=bullmq, instantiate BullMQAdapter
        // backed by Redis URL from REDIS_URL env. Until then, synchronous fallback
        // keeps semantics identical (await returns when job completes or fails).
        singleton = new InProcessQueue();
    }
    return singleton;
}

export async function enqueue<T>(name: JobName, payload: T): Promise<void> {
    return getQueue().enqueue(name, payload);
}

export function registerJob<T>(name: JobName, handler: (payload: T) => Promise<void>): void {
    getQueue().register(name, handler);
}
