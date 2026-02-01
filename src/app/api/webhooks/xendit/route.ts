import { NextRequest, NextResponse } from "next/server";
import { handleXenditWebhook } from "@/actions/payments";
import crypto from "crypto";

export const dynamic = 'force-dynamic';

// Verify Xendit webhook signature
function verifyWebhookSignature(body: string, signature: string): boolean {
    const webhookToken = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!webhookToken) {
        console.error("XENDIT_WEBHOOK_TOKEN not configured");
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookToken)
        .update(body)
        .digest("hex");

    return signature === expectedSignature;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const signature = request.headers.get("x-callback-token") || "";

        // Verify signature in production
        if (process.env.NODE_ENV === "production") {
            if (!verifyWebhookSignature(body, signature)) {
                console.error("Invalid webhook signature");
                return NextResponse.json(
                    { error: "Invalid signature" },
                    { status: 401 }
                );
            }
        }

        const data = JSON.parse(body);

        console.log("Xendit webhook received:", {
            id: data.id,
            external_id: data.external_id,
            status: data.status,
        });

        // Handle the webhook
        const result = await handleXenditWebhook({
            id: data.id,
            external_id: data.external_id,
            status: data.status,
            payment_method: data.payment_method,
            paid_at: data.paid_at,
        });

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
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
