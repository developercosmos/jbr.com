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
import { runProductEventRollup } from "@/actions/product-events";
import { runSearchTermRollup } from "@/actions/search-terms";
import { runSellerWeeklyDigestSweep } from "@/actions/seller-digest";
import { runSearchIndexReconcile } from "@/actions/search-index-sync";
import { runGlReconciliation } from "@/actions/accounting/reconciliation";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        // Fail-closed: refuse to run unauthenticated when no secret is configured.
        return false;
    }
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    return provided === expected;
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
        ] = await Promise.all([
            runEscrowAutoRelease(),
            runDisputeSlaSweep(),
            recomputeAllSellerRatingsForActiveSellers(),
            runOfferExpirySweep(),
            runOfferSlaFollowupSweep(),
            clearAttributionsForCompletedOrders(),
            runWishlistPriceDropSweep(),
            runCartAbandonmentSweep(),
            runProductEventRollup(),
            runSearchTermRollup(),
            runSellerWeeklyDigestSweep(),
            runSearchIndexReconcile(),
            runGlReconciliation(),
            runBuyerRatingOutlierDetection(),
            runFeatureFlagScheduledToggle(),
            runFeatureFlagCleanupNotices(),
            runPresencePruneSweep(),
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
