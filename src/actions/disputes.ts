"use server";

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { disputes, orders } from "@/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notify } from "@/lib/notify";
import { randomUUID } from "crypto";

const RESPONSE_HOURS = Number(process.env.DISPUTE_RESPONSE_HOURS || 24);
const RESOLUTION_HOURS = Number(process.env.DISPUTE_RESOLUTION_HOURS || 24 * 7);

function addHours(base: Date, hours: number) {
    return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

// ============================================
// BUYER: OPEN AN ORDER DISPUTE
// ============================================
const createOrderDisputeSchema = z.object({
    orderId: z.string().uuid(),
    type: z.enum([
        "ITEM_NOT_AS_DESCRIBED",
        "ITEM_NOT_RECEIVED",
        "REFUND_REQUEST",
        "SELLER_NOT_RESPONSIVE",
        "OTHER",
    ]),
    description: z.string().trim().min(10, "Jelaskan masalah minimal 10 karakter").max(2000),
});

// Order statuses where a buyer dispute makes sense (money is in escrow, goods in flight
// or claimed delivered). Not allowed before payment or after the order is closed out.
const DISPUTABLE_ORDER_STATUSES = ["PAID", "PACKING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export async function createOrderDispute(input: z.infer<typeof createOrderDisputeSchema>) {
    try {
        return await createOrderDisputeInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal membuka sengketa.");
        logger.warn("dispute:create_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function createOrderDisputeInternal(input: z.infer<typeof createOrderDisputeSchema>) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    const validated = createOrderDisputeSchema.parse(input);

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, validated.orderId), eq(orders.buyer_id, session.user.id)),
        columns: { id: true, order_number: true, status: true, buyer_id: true, seller_id: true },
    });
    if (!order) throw new Error("Pesanan tidak ditemukan");

    if (!DISPUTABLE_ORDER_STATUSES.includes(order.status as (typeof DISPUTABLE_ORDER_STATUSES)[number])) {
        throw new Error(`Pesanan berstatus ${order.status} tidak dapat disengketakan`);
    }

    // One open dispute per order — block duplicates.
    const existing = await db.query.disputes.findFirst({
        where: and(
            eq(disputes.order_id, validated.orderId),
            eq(disputes.dispute_subject, "ORDER"),
            sql`${disputes.status} IN ('OPEN','IN_PROGRESS','AWAITING_RESPONSE')`
        ),
        columns: { id: true },
    });
    if (existing) throw new Error("Sengketa untuk pesanan ini sudah dibuka dan sedang diproses.");

    const now = new Date();
    const disputeNumber = `DSP-ORD-${randomUUID().slice(0, 8).toUpperCase()}`;
    const typeTitles: Record<string, string> = {
        ITEM_NOT_AS_DESCRIBED: "Barang tidak sesuai deskripsi",
        ITEM_NOT_RECEIVED: "Barang tidak diterima",
        REFUND_REQUEST: "Permintaan pengembalian dana",
        SELLER_NOT_RESPONSIVE: "Penjual tidak responsif",
        OTHER: "Masalah pesanan",
    };

    const [created] = await db
        .insert(disputes)
        .values({
            order_id: order.id,
            reporter_id: order.buyer_id,
            reported_id: order.seller_id,
            dispute_number: disputeNumber,
            type: validated.type,
            dispute_subject: "ORDER",
            priority: "NORMAL",
            status: "OPEN",
            title: `${typeTitles[validated.type]} — ${order.order_number}`,
            description: validated.description,
            response_due_at: addHours(now, RESPONSE_HOURS),
            resolution_due_at: addHours(now, RESOLUTION_HOURS),
        })
        .returning({ id: disputes.id, dispute_number: disputes.dispute_number });

    // Notify seller + admin. notify() is idempotent per (event,key).
    try {
        await notify({
            event: "DISPUTE_OPENED",
            audience: "seller",
            recipientUserId: order.seller_id,
            disputeId: created.id,
            orderId: order.id,
            orderNumber: order.order_number,
            disputeType: validated.type,
        });
    } catch {
        // notification non-critical
    }

    revalidatePath("/profile/orders");
    revalidatePath(`/profile/orders/${order.id}`);
    revalidatePath("/admin/disputes");

    return { success: true as const, disputeId: created.id, disputeNumber: created.dispute_number };
}

// Returns the current buyer's open/active ORDER dispute for an order, if any
// (drives the order detail UI: show "report problem" vs "dispute in progress").
export async function getOrderDisputeForBuyer(orderId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const d = await db.query.disputes.findFirst({
        where: and(
            eq(disputes.order_id, orderId),
            eq(disputes.dispute_subject, "ORDER"),
            eq(disputes.reporter_id, session.user.id)
        ),
        columns: { id: true, dispute_number: true, status: true, type: true, created_at: true },
        orderBy: (t, { desc }) => [desc(t.created_at)],
    });
    return d ?? null;
}

function computeDisputeSla(createdAt: Date = new Date()) {
    return {
        responseDueAt: addHours(createdAt, RESPONSE_HOURS),
        resolutionDueAt: addHours(createdAt, RESOLUTION_HOURS),
    };
}

export interface DisputeSlaSweepResult {
    inspected: number;
    escalated: number;
    escalatedDisputeIds: string[];
}

export async function runDisputeSlaSweep(): Promise<DisputeSlaSweepResult> {
    const now = new Date();

    const breached = await db
        .select({ id: disputes.id })
        .from(disputes)
        .where(
            and(
                isNotNull(disputes.response_due_at),
                lte(disputes.response_due_at, now),
                sql`${disputes.status} IN ('OPEN', 'AWAITING_RESPONSE')`
            )
        );

    if (breached.length === 0) {
        return { inspected: 0, escalated: 0, escalatedDisputeIds: [] };
    }

    const escalatedIds: string[] = [];

    for (const row of breached) {
        const updated = await db
            .update(disputes)
            .set({
                status: "IN_PROGRESS",
                priority: "HIGH",
                escalation_count: sql`${disputes.escalation_count} + 1`,
                updated_at: new Date(),
            })
            .where(eq(disputes.id, row.id))
            .returning({ id: disputes.id });
        if (updated[0]) {
            escalatedIds.push(updated[0].id);
        }
    }

    return {
        inspected: breached.length,
        escalated: escalatedIds.length,
        escalatedDisputeIds: escalatedIds,
    };
}
