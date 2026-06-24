/**
 * Per-process internal-call token. Functions that live in a "use server" module
 * but must ONLY be invoked server-side (webhook handlers — faking one could mark
 * an order PAID or complete a payout) accept this token and assert it. The value
 * is a random per-process secret, never sent to the client, so an anonymous
 * Server-Action caller cannot supply it. Legitimate server callers import it.
 */
import "server-only";
import crypto from "crypto";

export const INTERNAL_CALL_TOKEN = crypto.randomUUID();

export function assertInternalCall(token: string | undefined): void {
    if (token !== INTERNAL_CALL_TOKEN) {
        throw new Error("Forbidden: internal-only function");
    }
}
