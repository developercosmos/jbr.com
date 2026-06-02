import { NextRequest, NextResponse } from "next/server";
import { handleXenditWebhook } from "@/actions/payments";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// Xendit authenticates callbacks with a STATIC verification token sent verbatim in
// the `x-callback-token` header (see https://docs.xendit.co/docs/handling-webhooks).
// It is NOT an HMAC of the request body. Compare the received token against the
// configured token in constant time.
function verifyCallbackToken(received: string): boolean {
    const expected = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!expected) {
        // No token configured: reject in production, allow only for local dev.
        if (process.env.NODE_ENV === "production") {
            console.error("XENDIT_WEBHOOK_TOKEN not configured — rejecting callback");
            return false;
        }
        return true;
    }
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    // timingSafeEqual throws on length mismatch — guard first so a wrong-length
    // token is a clean reject, not a 500.
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const token = request.headers.get("x-callback-token") || "";

        if (!verifyCallbackToken(token)) {
            console.error("Invalid Xendit callback token");
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const data = JSON.parse(body);

        console.log("Xendit webhook received:", {
            id: data.id,
            external_id: data.external_id,
            status: data.status,
        });

        const result = await handleXenditWebhook({
            id: data.id,
            external_id: data.external_id,
            status: data.status,
            payment_method: data.payment_method,
            paid_at: data.paid_at,
        });

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Xendit webhook error:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}
