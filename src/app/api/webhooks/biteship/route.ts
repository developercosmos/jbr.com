import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getBiteshipSettings } from "@/lib/biteship";
import { applyBiteshipStatusUpdate } from "@/lib/biteship-status";

export const dynamic = "force-dynamic";

function tokenMatches(provided: string, expected: string): boolean {
    if (!expected || !provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false; // timingSafeEqual throws on length mismatch
    return crypto.timingSafeEqual(a, b);
}

// Biteship webhook receiver (order.status / order.waybill_id / order.price).
// Register in the Biteship dashboard with EITHER auth (both checked against
// credentials.webhook_token in admin settings, or env BITESHIP_WEBHOOK_TOKEN):
//   - URL token:  https://jualbeliraket.com/api/webhooks/biteship?token=<secret>
//   - Header:     "Headers Signature Key" = X-Webhook-Token,
//                 "Headers Signature Secret" = <secret>
// Fail-closed: no configured token => reject all. Constant-time comparison.
export async function POST(request: NextRequest) {
    const settings = await getBiteshipSettings();
    const expected = settings.webhookToken;
    const provided =
        request.headers.get("x-webhook-token") ??
        request.nextUrl.searchParams.get("token") ??
        "";
    if (!tokenMatches(provided, expected)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = String(body.event ?? "");
    const biteshipOrderId = String(body.order_id ?? body.id ?? "");
    const status = String(body.status ?? "");
    const waybillId =
        (body.courier_waybill_id as string | undefined) ?? (body.waybill_id as string | undefined) ?? null;

    if (!biteshipOrderId) {
        // Nothing to correlate — acknowledge so Biteship doesn't retry forever.
        console.warn("[biteship-webhook] event without order_id:", event);
        return NextResponse.json({ received: true, ignored: true });
    }

    // Price corrections (actual weight differs from the quote) are informational:
    // the buyer already paid the quoted amount; discrepancies settle against the
    // platform's Biteship balance and are reviewed from the Biteship dashboard.
    if (event === "order.price") {
        console.log(`[biteship-webhook] price update for ${biteshipOrderId}:`, JSON.stringify(body).slice(0, 500));
        return NextResponse.json({ received: true });
    }

    const result = await applyBiteshipStatusUpdate({ biteshipOrderId, status, waybillId });
    return NextResponse.json({ received: true, handled: result.handled, action: result.action ?? null });
}
