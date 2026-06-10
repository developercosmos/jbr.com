import { NextRequest, NextResponse } from "next/server";
import { getBiteshipSettings } from "@/lib/biteship";
import { applyBiteshipStatusUpdate } from "@/lib/biteship-status";

export const dynamic = "force-dynamic";

// Biteship webhook receiver (order.status / order.waybill_id / order.price).
// Register in the Biteship dashboard as:
//   https://jualbeliraket.com/api/webhooks/biteship?token=<webhook_token>
// Biteship does not sign webhook payloads, so authentication is a shared-secret
// token in the URL, compared against credentials.webhook_token (admin settings)
// or BITESHIP_WEBHOOK_TOKEN. Fail-closed: no configured token => reject all.
export async function POST(request: NextRequest) {
    const settings = await getBiteshipSettings();
    const expected = settings.webhookToken;
    const provided = request.nextUrl.searchParams.get("token") ?? "";
    if (!expected || provided !== expected) {
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
