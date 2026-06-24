import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { finalizeDisbursementWebhook } from "@/actions/payouts";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";

export const dynamic = "force-dynamic";

// Same static x-callback-token scheme as the invoice webhook.
function verifyCallbackToken(received: string): boolean {
    const expected = process.env.XENDIT_WEBHOOK_TOKEN;
    if (!expected) {
        if (process.env.NODE_ENV === "production") {
            console.error("XENDIT_WEBHOOK_TOKEN not configured — rejecting disbursement callback");
            return false;
        }
        return true;
    }
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.text();
        const token = request.headers.get("x-callback-token") || "";
        if (!verifyCallbackToken(token)) {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        const data = JSON.parse(body) as {
            id?: string;
            external_id?: string;
            status?: string;
            failure_code?: string;
        };

        await finalizeDisbursementWebhook({
            externalId: data.external_id,
            disbursementId: data.id,
            status: String(data.status ?? ""),
            failureReason: data.failure_code || undefined,
        }, INTERNAL_CALL_TOKEN);

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Xendit disbursement webhook error:", error);
        // 500 so Xendit retries — finalizeDisbursementWebhook is idempotent.
        return NextResponse.json({ error: "processing error" }, { status: 500 });
    }
}
