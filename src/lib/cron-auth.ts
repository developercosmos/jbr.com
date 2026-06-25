import "server-only";
import crypto from "crypto";

/**
 * Constant-time Bearer CRON_SECRET check, shared by all /api/cron/* routes.
 * Fails closed when CRON_SECRET is unset. Using timingSafeEqual (instead of ===)
 * avoids leaking the secret one byte at a time via response-timing.
 */
export function isAuthorizedCron(request: Request): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}
