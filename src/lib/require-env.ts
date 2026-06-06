/**
 * Read an env var; in production a missing required var fails fast (surfaces the
 * misconfiguration instead of silently falling back to a dev/localhost value).
 * In non-production it returns the provided dev fallback so local dev still runs.
 */
export function envOrThrowInProd(name: string, devFallback: string): string {
    const v = process.env[name];
    if (v && v.trim()) return v;
    if (process.env.NODE_ENV === "production") {
        throw new Error(`[config] Missing required environment variable in production: ${name}`);
    }
    return devFallback;
}
