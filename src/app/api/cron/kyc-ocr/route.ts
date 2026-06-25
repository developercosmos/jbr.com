import { NextRequest, NextResponse } from "next/server";
import { runAffiliateOcrSweep, runKycOcrSweep } from "@/actions/kyc-ocr";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

// Dedicated cron route (separate from trust-sweeps) because each OCR call takes
// ~30s; isolating it keeps the shared sweep fast and lets ops pick its own cadence.
// Schedule e.g. every 5 minutes:
//   * /5 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//                   https://jualbeliraket.com/api/cron/kyc-ocr
function isAuthorized(request: NextRequest): boolean {
    return isAuthorizedCron(request);
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        // Sequential on purpose: both sweeps share the same single LLM box.
        const kycOcr = await runKycOcrSweep(INTERNAL_CALL_TOKEN);
        const affiliateOcr = await runAffiliateOcrSweep(INTERNAL_CALL_TOKEN);
        return NextResponse.json({ success: true, kycOcr, affiliateOcr, ranAt: new Date().toISOString() });
    } catch (error) {
        console.error("[kyc-ocr] sweep failure:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Sweep failed" },
            { status: 500 }
        );
    }
}
