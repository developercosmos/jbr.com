/**
 * TECH-03: Sentry server-side init.
 *
 * Loaded once at server boot when SENTRY_DSN is set. No-op without DSN so
 * dev/local builds don't ship a Sentry connection.
 *
 * The `tracesSampleRate` is intentionally low to keep volume manageable;
 * raise per environment as needed via SENTRY_TRACES_SAMPLE_RATE.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
        // Capture unhandled rejections + uncaught exceptions automatically.
        // logger.error/warn calls are forwarded explicitly via lib/logger.ts.
    });
}
