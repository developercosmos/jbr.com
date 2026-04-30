import { NextRequest, NextResponse } from "next/server";
import { getPdpPresenceSnapshot, pingPdpPresence } from "@/actions/pdp-presence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DIF-08: Live presence endpoint.
 *
 * GET  → return current snapshot { viewers, bidders, label }.
 * POST → upsert this client's presence ping.
 *
 * We chose long-poll (15s client-side interval) over real SSE because:
 *   - Postgres-backed presence updates are batched ≤ 30s anyway.
 *   - SSE adds infra cost (keep-alive connections per PM2 worker).
 *   - Long-poll trivially survives middleware rate-limit + Cloudflare.
 */

export async function GET(_request: NextRequest, context: { params: Promise<{ productId: string }> }) {
    const { productId } = await context.params;
    if (!productId) {
        return NextResponse.json({ error: "missing productId" }, { status: 400 });
    }
    const snap = await getPdpPresenceSnapshot(productId);
    return NextResponse.json(snap, {
        headers: {
            "Cache-Control": "no-store",
        },
    });
}

export async function POST(request: NextRequest, context: { params: Promise<{ productId: string }> }) {
    const { productId } = await context.params;
    let body: { sessionId?: string; intent?: "view" | "bidding" } = {};
    try {
        body = await request.json();
    } catch {
        // empty body is fine
    }
    const sessionId = body.sessionId?.slice(0, 64) ?? "";
    if (!productId || !sessionId) {
        return NextResponse.json({ error: "missing productId or sessionId" }, { status: 400 });
    }

    await pingPdpPresence({ productId, sessionId, intent: body.intent });
    const snap = await getPdpPresenceSnapshot(productId);
    return NextResponse.json(snap);
}
