import * as Sentry from "@sentry/nextjs";

// Browser error monitoring. Initializes only when a public DSN is configured.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
    Sentry.init({
        dsn,
        tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.1),
        environment: process.env.NODE_ENV,
    });
}

// Required by Next.js to capture navigation timing for client instrumentation.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
