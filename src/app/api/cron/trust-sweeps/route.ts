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

    try {
        const [
            escrow,
            dispute,
            reputation,
            offers,
            offerSla,
            affiliate,
            wishlistAlerts,
            abandonment,
            eventRollup,
            searchTermRollup,
            sellerDigest,
            searchIndexReconcile,
            glReconciliation,
            buyerRatingOutliers,
            flagScheduled,
            flagCleanup,
            presencePrune,
            paymentsReconcile,
            chatReminders,
            expiredOfferCart,
            orderExpiry,
        ] = await Promise.all([
            runEscrowAutoRelease(INTERNAL_CALL_TOKEN),
            runDisputeSlaSweep(INTERNAL_CALL_TOKEN),
            recomputeAllSellerRatingsForActiveSellers(INTERNAL_CALL_TOKEN),
            runOfferExpirySweep(INTERNAL_CALL_TOKEN),
            runOfferSlaFollowupSweep(INTERNAL_CALL_TOKEN),
            clearAttributionsForCompletedOrders(INTERNAL_CALL_TOKEN),
            runWishlistPriceDropSweep(INTERNAL_CALL_TOKEN),
            runCartAbandonmentSweep(INTERNAL_CALL_TOKEN),
            runProductEventRollup(INTERNAL_CALL_TOKEN),
            runSearchTermRollup(INTERNAL_CALL_TOKEN),
            runSellerWeeklyDigestSweep(INTERNAL_CALL_TOKEN),
            runSearchIndexReconcile(INTERNAL_CALL_TOKEN),
            runGlReconciliation(),
            runBuyerRatingOutlierDetection(INTERNAL_CALL_TOKEN),
            runFeatureFlagScheduledToggle(INTERNAL_CALL_TOKEN),
            runFeatureFlagCleanupNotices(INTERNAL_CALL_TOKEN),
            runPresencePruneSweep(INTERNAL_CALL_TOKEN),
            reconcilePendingPayments(100, INTERNAL_CALL_TOKEN),
            runUnansweredChatReminderSweep(INTERNAL_CALL_TOKEN),
            runExpiredOfferCartSweep(INTERNAL_CALL_TOKEN),
            runOrderExpirySweep(INTERNAL_CALL_TOKEN),
        ]);

        return NextResponse.json({
            success: true,
            escrow,
            dispute,
            reputation,
            offers,
            offerSla,
            affiliate,
            wishlistAlerts,
            abandonment,
            eventRollup,
            searchTermRollup,
            sellerDigest,
            searchIndexReconcile,
            glReconciliation,
            buyerRatingOutliers,
            flagScheduled,
            flagCleanup,
            presencePrune,
            paymentsReconcile,
            chatReminders,
            expiredOfferCart,
            orderExpiry,
            ranAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("[trust-sweeps] failure:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Sweep failed",
            },
            { status: 500 }
        );
    }
}
