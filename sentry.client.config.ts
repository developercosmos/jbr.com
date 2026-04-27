/**
 * TECH-03: Sentry browser-side init.
 *
 * Loaded only when NEXT_PUBLIC_SENTRY_DSN is set so the bundle stays small
 * for users on dev/local. Browser DSN can be different from server DSN and
 * is intentionally exposed via the NEXT_PUBLIC_ prefix.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.05),
    });
}
