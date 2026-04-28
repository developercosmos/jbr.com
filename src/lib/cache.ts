/**
 * CACHE-02: thin Redis-backed cache wrapper for catalog reads.
 *
 * Designed to hide cache miss/hit complexity behind a single `cached(key, ttl, loader)`
 * helper. Reuses the same Redis instance as BullMQ (port 6379) via lazy ioredis client.
 *
 * Usage:
 *   const data = await cached("catalog:categories:v1", 300, () => loadFromDb());
 *
 * Falls back to direct loader execution when REDIS_URL is unset or Redis is
 * unreachable, so dev/local stays simple.
 */
import type { Redis } from "ioredis";
import { logger } from "@/lib/logger";

let clientPromise: Promise<Redis | null> | null = null;

async function getClient(): Promise<Redis | null> {
    if (!process.env.REDIS_URL) return null;
    if (!clientPromise) {
        clientPromise = (async () => {
            try {
                const { default: IORedis } = await import("ioredis");
                const c = new IORedis(process.env.REDIS_URL!, {
                    maxRetriesPerRequest: 1,
                    lazyConnect: false,
                });
                c.on("error", (err) => {
                    logger.warn("cache:redis_error", { error: String(err) });
                });
                return c;
            } catch (error) {
                logger.warn("cache:redis_init_failed", { error: String(error) });
                return null;
            }
        })();
    }
    return clientPromise;
}

export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const client = await getClient();
    if (!client) return loader();

    try {
        const raw = await client.get(key);
        if (raw) {
            return JSON.parse(raw) as T;
        }
    } catch (error) {
        logger.warn("cache:get_failed", { key, error: String(error) });
    }

    const value = await loader();
    try {
        await client.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
        logger.warn("cache:set_failed", { key, error: String(error) });
    }
    return value;
}

export async function invalidatePrefix(prefix: string): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
        const keys: string[] = [];
        let cursor = "0";
        do {
            const [next, batch] = await client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 200);
            cursor = next;
            keys.push(...batch);
        } while (cursor !== "0");
        if (keys.length > 0) {
            await client.del(...keys);
        }
    } catch (error) {
        logger.warn("cache:invalidate_failed", { prefix, error: String(error) });
    }
}

export async function invalidateKey(key: string): Promise<void> {
    const client = await getClient();
    if (!client) return;
    try {
        await client.del(key);
    } catch (error) {
        logger.warn("cache:del_failed", { key, error: String(error) });
    }
}
