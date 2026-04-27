/**
 * Next.js instrumentation hook — runs once at server startup (Node runtime).
 * Used to bind background job workers so BullMQ pulls from Redis as soon as
 * the Next process is up. Safe to no-op in edge runtime.
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { bindQueueWorkers } = await import("@/lib/queue-workers");
        bindQueueWorkers();
    }
}
