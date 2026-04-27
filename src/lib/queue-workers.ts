/**
 * TECH-01: Job worker registry — bound at server boot.
 *
 * Each registered handler runs:
 *   - synchronously inside enqueue() for the in-process driver, or
 *   - on a BullMQ Worker pulling from Redis for the bullmq driver.
 *
 * This module is imported once from instrumentation.ts so workers come up
 * with the Next.js process. The handlers themselves intentionally stay thin —
 * they delegate to existing actions/lib so behavior is unchanged whichever
 * driver runs them.
 */

import { logger } from "@/lib/logger";
import { registerJob } from "@/lib/queue";

let bound = false;

export function bindQueueWorkers(): void {
    if (bound) return;
    bound = true;

    // send-email: payload echoes the notify event metadata. The actual email
    // dispatch already runs inside notify(); this worker exists to provide a
    // structured retry surface and per-event audit log when the BullMQ adapter
    // is active. Idempotency is upstream (notify writes a unique idempotency
    // key into notifications before enqueueing).
    registerJob<{
        event: string;
        recipientUserId: string;
        idempotencyKey: string;
    }>("send-email", async (payload) => {
        logger.info("worker:send-email", {
            event: payload.event,
            recipientUserId: payload.recipientUserId,
            idempotencyKey: payload.idempotencyKey,
        });
        // The actual email transport is synchronous inside notify() today.
        // Once we move email to a background-only path, this is the place to
        // call the transport (resend/nodemailer) with retry semantics.
    });

    // recompute-seller-rating: delegates to actions/reputation.
    registerJob<{ sellerId: string }>("recompute-seller-rating", async ({ sellerId }) => {
        const { recomputeSellerRating } = await import("@/actions/reputation");
        await recomputeSellerRating(sellerId);
        logger.info("worker:recompute-seller-rating:done", { sellerId });
    });
}
