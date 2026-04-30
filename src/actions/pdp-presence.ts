"use server";

import { db } from "@/db";
import { pdp_presence_pings } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { and, eq, gte, sql } from "drizzle-orm";

const PRESENCE_TTL_MS = 90_000; // 90 detik
const PRIVACY_FLOOR = 2; // tidak expose count = 1 untuk anti-fingerprint

/**
 * DIF-08: Live buyer presence indicator.
 *
 * Implementation: Postgres-backed (no Redis dep). Each PDP impression upserts
 * a row keyed by (productId, sessionId) with last_seen_at = NOW(). Counts are
 * computed by SELECT WHERE last_seen_at > NOW() - 90s.
 *
 * Privacy: aggregate count only, never identity. Floor at 2 so single-viewer
 * scenarios show "Sedang dilihat" without revealing exact head-count.
 */

export async function pingPdpPresence(input: {
    productId: string;
    sessionId: string;
    intent?: "view" | "bidding";
}): Promise<{ accepted: boolean }> {
    const enabled = await isFeatureEnabled("dif.live_presence", { bucketKey: input.sessionId });
    if (!enabled) return { accepted: false };

    const safeSessionId = input.sessionId.slice(0, 64);
    if (!safeSessionId) return { accepted: false };

    await db
        .insert(pdp_presence_pings)
        .values({
            product_id: input.productId,
            session_id: safeSessionId,
            intent: input.intent ?? "view",
            last_seen_at: new Date(),
        })
        .onConflictDoUpdate({
            target: [pdp_presence_pings.product_id, pdp_presence_pings.session_id],
            set: {
                intent: input.intent ?? "view",
                last_seen_at: new Date(),
            },
        });

    return { accepted: true };
}

export interface PresenceSnapshot {
    viewers: number;
    bidders: number;
    /** Display label respecting PRIVACY_FLOOR. Null = nothing to display. */
    label: string | null;
}

export async function getPdpPresenceSnapshot(productId: string): Promise<PresenceSnapshot> {
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS);

    const rows = await db
        .select({
            intent: pdp_presence_pings.intent,
            count: sql<number>`count(*)::int`,
        })
        .from(pdp_presence_pings)
        .where(
            and(
                eq(pdp_presence_pings.product_id, productId),
                gte(pdp_presence_pings.last_seen_at, cutoff)
            )
        )
        .groupBy(pdp_presence_pings.intent);

    let viewers = 0;
    let bidders = 0;
    for (const row of rows) {
        if (row.intent === "bidding") bidders = Number(row.count);
        else viewers = Number(row.count);
    }

    let label: string | null = null;
    const total = viewers + bidders;
    if (total >= PRIVACY_FLOOR) {
        const parts: string[] = [];
        if (viewers >= PRIVACY_FLOOR) parts.push(`${viewers} sedang melihat`);
        else if (viewers === 1 && total >= PRIVACY_FLOOR) parts.push("Sedang dilihat");
        if (bidders > 0) parts.push(bidders === 1 ? "1 sedang menawar" : `${bidders} sedang menawar`);
        label = parts.join(" • ");
    } else if (total === 1) {
        label = "Sedang dilihat";
    }

    return { viewers, bidders, label };
}

/**
 * Cron sweep: prune presence rows older than TTL to keep the table small.
 */
export async function runPresencePruneSweep(): Promise<{ pruned: number }> {
    const cutoff = new Date(Date.now() - PRESENCE_TTL_MS * 4); // 6 menit
    const result = await db.execute(
        sql`DELETE FROM pdp_presence_pings WHERE last_seen_at < ${cutoff.toISOString()}::timestamp`
    );
    return { pruned: (result as unknown as { rowCount?: number }).rowCount ?? 0 };
}
