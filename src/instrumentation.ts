/**
 * Next.js instrumentation hook — runs once at server startup.
 * 1. Initializes Sentry (server + edge) when SENTRY_DSN is set (no-op otherwise).
 * 2. Binds background job workers (Node runtime only) so BullMQ pulls from Redis
 *    as soon as the Next process is up.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
    const dsn = process.env.SENTRY_DSN;
    if (dsn) {
        Sentry.init({
            dsn,
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
            environment: process.env.NODE_ENV,
        });
    }

    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { bindQueueWorkers } = await import("@/lib/queue-workers");
        bindQueueWorkers();
    }
}

// Captures errors thrown in server components, route handlers, and server actions.
export const onRequestError = Sentry.captureRequestError;
