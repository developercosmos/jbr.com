import { NextRequest, NextResponse } from "next/server";
import { runKycOcrSweep } from "@/actions/kyc-ocr";

export const dynamic = "force-dynamic";

// Dedicated cron route (separate from trust-sweeps) because each OCR call takes
// ~30s; isolating it keeps the shared sweep fast and lets ops pick its own cadence.
// Schedule e.g. every 5 minutes:
//   * /5 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
//                   https://jualbeliraket.com/api/cron/kyc-ocr
function isAuthorized(request: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false; // fail-closed
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    return provided === expected;
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const result = await runKycOcrSweep();
        return NextResponse.json({ success: true, kycOcr: result, ranAt: new Date().toISOString() });
    } catch (error) {
        console.error("[kyc-ocr] sweep failure:", error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Sweep failed" },
            { status: 500 }
        );
    }
}
