import { NextRequest, NextResponse } from "next/server";
import { runEscrowAutoRelease } from "@/actions/escrow";
import { runDisputeSlaSweep } from "@/actions/disputes";
import { recomputeAllSellerRatingsForActiveSellers, runBuyerRatingOutlierDetection } from "@/actions/reputation";
import { runFeatureFlagScheduledToggle, runFeatureFlagCleanupNotices } from "@/actions/admin/feature-flags-cron";
import { runPresencePruneSweep } from "@/actions/pdp-presence";
import { runOfferExpirySweep, runOfferSlaFollowupSweep } from "@/actions/offers";
import { clearAttributionsForCompletedOrders } from "@/actions/affiliate";
import { runWishlistPriceDropSweep } from "@/actions/wishlist-alerts";
import { runCartAbandonmentSweep } from "@/actions/cart-abandonment";
import { runExpiredOfferCartSweep } from "@/actions/cart";
import { runProductEventRollup } from "@/actions/product-events";
import { runSearchTermRollup } from "@/actions/search-terms";
import { runSellerWeeklyDigestSweep } from "@/actions/seller-digest";
import { runSearchIndexReconcile } from "@/actions/search-index-sync";
import { runGlReconciliation } from "@/actions/accounting/reconciliation";
import { reconcilePendingPayments, runOrderExpirySweep } from "@/actions/payments";
import { runUnansweredChatReminderSweep } from "@/actions/chat-reminders";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
    return isAuthorizedCron(request);
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // RESILIENCE: run every sweep independently. A single sweep throwing must NOT
    // abort the others — previously `Promise.all` meant one rejection silently
    // disabled ALL periodic jobs for that run. Failures are collected + surfaced
    // (HTTP 207 + `errors`) so the cron runner's fail-marker / mail fires, while the
    // healthy sweeps still complete.
    const tasks: { key: string; run: () => Promise<unknown> }[] = [
        { key: "escrow", run: () => runEscrowAutoRelease(INTERNAL_CALL_TOKEN) },
        { key: "dispute", run: () => runDisputeSlaSweep(INTERNAL_CALL_TOKEN) },
        { key: "reputation", run: () => recomputeAllSellerRatingsForActiveSellers(INTERNAL_CALL_TOKEN) },
        { key: "offers", run: () => runOfferExpirySweep(INTERNAL_CALL_TOKEN) },
        { key: "offerSla", run: () => runOfferSlaFollowupSweep(INTERNAL_CALL_TOKEN) },
        { key: "affiliate", run: () => clearAttributionsForCompletedOrders(INTERNAL_CALL_TOKEN) },
        { key: "wishlistAlerts", run: () => runWishlistPriceDropSweep(INTERNAL_CALL_TOKEN) },
        { key: "abandonment", run: () => runCartAbandonmentSweep(INTERNAL_CALL_TOKEN) },
        { key: "eventRollup", run: () => runProductEventRollup(INTERNAL_CALL_TOKEN) },
        { key: "searchTermRollup", run: () => runSearchTermRollup(INTERNAL_CALL_TOKEN) },
        { key: "sellerDigest", run: () => runSellerWeeklyDigestSweep(INTERNAL_CALL_TOKEN) },
        { key: "searchIndexReconcile", run: () => runSearchIndexReconcile(INTERNAL_CALL_TOKEN) },
        { key: "glReconciliation", run: () => runGlReconciliation() },
        { key: "buyerRatingOutliers", run: () => runBuyerRatingOutlierDetection(INTERNAL_CALL_TOKEN) },
        { key: "flagScheduled", run: () => runFeatureFlagScheduledToggle(INTERNAL_CALL_TOKEN) },
        { key: "flagCleanup", run: () => runFeatureFlagCleanupNotices(INTERNAL_CALL_TOKEN) },
        { key: "presencePrune", run: () => runPresencePruneSweep(INTERNAL_CALL_TOKEN) },
        { key: "paymentsReconcile", run: () => reconcilePendingPayments(100, INTERNAL_CALL_TOKEN) },
        { key: "chatReminders", run: () => runUnansweredChatReminderSweep(INTERNAL_CALL_TOKEN) },
        { key: "expiredOfferCart", run: () => runExpiredOfferCartSweep(INTERNAL_CALL_TOKEN) },
        { key: "orderExpiry", run: () => runOrderExpirySweep(INTERNAL_CALL_TOKEN) },
    ];

    const settled = await Promise.allSettled(tasks.map((t) => t.run()));
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};
    settled.forEach((r, i) => {
        const key = tasks[i].key;
        if (r.status === "fulfilled") {
            results[key] = r.value;
        } else {
            errors[key] = r.reason instanceof Error ? r.reason.message : String(r.reason);
            console.error(`[trust-sweeps] sweep '${key}' failed:`, r.reason);
        }
    });

    const hasErrors = Object.keys(errors).length > 0;
    return NextResponse.json(
        {
            success: !hasErrors,
            ...results,
            ...(hasErrors ? { errors } : {}),
            ranAt: new Date().toISOString(),
        },
        { status: hasErrors ? 207 : 200 }
    );
}
