"use server";

import { db } from "@/db";
import { carts, products, users } from "@/db/schema";
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { logger } from "@/lib/logger";
import { assertInternalCall } from "@/lib/internal-guard";

const STAGE_1_HOURS = Number(process.env.ABANDONMENT_STAGE_1_HOURS || 1);
const STAGE_2_HOURS = Number(process.env.ABANDONMENT_STAGE_2_HOURS || 24);
const STAGE_3_HOURS = Number(process.env.ABANDONMENT_STAGE_3_HOURS || 72);

type Stage = "STAGE_1" | "STAGE_2" | "STAGE_3";

export interface AbandonmentSweepResult {
    inspected: number;
    dispatched: number;
    perStage: Record<Stage, number>;
}

interface CartGroup {
    userId: string;
    userEmail: string;
    userName: string | null;
    cartIds: string[];
    itemTitles: string[];
    earliestMutation: Date;
    currentState: string | null;
}

async function loadActiveAbandonedCarts(now: Date): Promise<CartGroup[]> {
    const stage1Cutoff = new Date(now.getTime() - STAGE_1_HOURS * 60 * 60 * 1000);
    const rows = await db
        .select({
            cart_id: carts.id,
            user_id: carts.user_id,
            last_mutated_at: carts.last_mutated_at,
            abandonment_state: carts.abandonment_state,
            user_email: users.email,
            user_name: users.name,
            product_title: products.title,
        })
        .from(carts)
        .innerJoin(users, eq(users.id, carts.user_id))
        .innerJoin(products, eq(products.id, carts.product_id))
        .where(
            and(
                eq(carts.saved_for_later, false),
                lt(carts.last_mutated_at, stage1Cutoff),
                or(isNull(carts.abandonment_state), ne(carts.abandonment_state, "STAGE_3"))
            )
        );

    const grouped = new Map<string, CartGroup>();
    for (const row of rows) {
        const existing = grouped.get(row.user_id);
        if (existing) {
            existing.cartIds.push(row.cart_id);
            existing.itemTitles.push(row.product_title);
            if (row.last_mutated_at < existing.earliestMutation) {
                existing.earliestMutation = row.last_mutated_at;
            }
        } else {
            grouped.set(row.user_id, {
                userId: row.user_id,
                userEmail: row.user_email,
                userName: row.user_name,
                cartIds: [row.cart_id],
                itemTitles: [row.product_title],
                earliestMutation: row.last_mutated_at,
                currentState: row.abandonment_state,
            });
        }
    }
    return Array.from(grouped.values());
}

function nextStageFor(group: CartGroup, now: Date): Stage | null {
    const ageHours = (now.getTime() - group.earliestMutation.getTime()) / (60 * 60 * 1000);
    if (ageHours >= STAGE_3_HOURS && group.currentState !== "STAGE_3") return "STAGE_3";
    if (ageHours >= STAGE_2_HOURS && group.currentState !== "STAGE_2" && group.currentState !== "STAGE_3") return "STAGE_2";
    if (ageHours >= STAGE_1_HOURS && group.currentState === null) return "STAGE_1";
    return null;
}

/**
 * ALERT-02: cart abandonment sweep — REMINDER ONLY at STAGE_1 (1h) / STAGE_2 (24h) /
 * STAGE_3 (72h). It does NOT auto-issue any discount voucher: an unsolicited voucher's
 * discount is settled out of the SELLER's payout (order.total is net of discount, seller
 * credited order.total - fee), so the platform must never mint one on the seller's
 * behalf. Idempotent per (cartId, stage) via notify idempotency key.
 */
export async function runCartAbandonmentSweep(internalToken?: string): Promise<AbandonmentSweepResult> {
    assertInternalCall(internalToken);
    const now = new Date();
    const groups = await loadActiveAbandonedCarts(now);
    const perStage: Record<Stage, number> = { STAGE_1: 0, STAGE_2: 0, STAGE_3: 0 };
    let dispatched = 0;

    for (const group of groups) {
        const stage = nextStageFor(group, now);
        if (!stage) continue;

        try {
            const result = await notify({
                event: "CART_ABANDONMENT_REMINDER",
                recipientUserId: group.userId,
                cartId: group.cartIds[0], // representative; idempotency keyed on first cart entry
                stage,
                itemTitles: group.itemTitles,
            });

            if (!result.duplicate) {
                dispatched++;
                perStage[stage]++;
                await db
                    .update(carts)
                    .set({ abandonment_state: stage })
                    .where(and(eq(carts.user_id, group.userId), eq(carts.saved_for_later, false)));
            }
        } catch (error) {
            logger.error("abandonment:dispatch_failed", {
                userId: group.userId,
                stage,
                error: String(error),
            });
        }
    }

    return { inspected: groups.length, dispatched, perStage };
}

void sql;
