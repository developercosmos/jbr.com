"use server";

import { db } from "@/db";
import { orders, disputes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, inArray, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { recomputeSellerRating } from "@/actions/reputation";
import { recordOrderRelease } from "@/actions/ledger";
import { postOrderRelease } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { logger } from "@/lib/logger";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

async function hasActiveDispute(orderId: string): Promise<boolean> {
    const result = await db
        .select({ id: disputes.id })
        .from(disputes)
        .where(
            and(
                eq(disputes.order_id, orderId),
                inArray(disputes.status, ["OPEN", "IN_PROGRESS", "AWAITING_RESPONSE"])
            )
        )
        .limit(1);
    return result.length > 0;
}

async function completeOrder(orderId: string, autoReleased: boolean) {
    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        columns: {
            id: true,
            order_number: true,
            buyer_id: true,
            seller_id: true,
            status: true,
            total: true,
        },
        with: {
            items: {
                columns: {
                    id: true,
                    product_id: true,
                    variant_id: true,
                    quantity: true,
                    price: true,
                    resolved_fee_value: true,
                },
            },
        },
    });

    if (!order) return null;
    if (order.status !== "DELIVERED") return null;

    if (await hasActiveDispute(orderId)) {
        // Pause auto-release while dispute is active; cron will revisit later.
        await db
            .update(orders)
            .set({ release_due_at: null, updated_at: new Date() })
            .where(eq(orders.id, orderId));
        return null;
    }

    await db
        .update(orders)
        .set({
            status: "COMPLETED",
            release_due_at: null,
            updated_at: new Date(),
        })
        .where(eq(orders.id, orderId));

    await notify({
        event: "ORDER_COMPLETED",
        audience: "buyer",
        recipientUserId: order.buyer_id,
        orderId: order.id,
        orderNumber: order.order_number,
        autoReleased,
    });

    await notify({
        event: "ORDER_COMPLETED",
        audience: "seller",
        recipientUserId: order.seller_id,
        orderId: order.id,
        orderNumber: order.order_number,
        autoReleased,
    });

    // RATE-01: completion changes completion_rate; refresh the aggregate.
    await recomputeSellerRating(order.seller_id);

    // MON-03: release escrow → seller wallet + platform revenue ledger entries.
    try {
        const platformFee = order.items.reduce(
            (sum, item) => sum + Number(item.resolved_fee_value || 0),
            0
        );
        await recordOrderRelease({
            orderId: order.id,
            sellerId: order.seller_id,
            grossAmount: parseFloat(order.total),
            platformFee,
        });
    } catch (ledgerError) {
        logger.error("ledger:record_order_release_failed", { orderId: order.id, error: String(ledgerError) });
    }

    // GL-14: dual-write to PSAK GL + sales_register (Phase 2).
    try {
        const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
        if (dualWrite) {
            await postOrderRelease({
                orderId: order.id,
                sellerId: order.seller_id,
                buyerId: order.buyer_id,
                grossPaid: parseFloat(order.total),
                items: order.items.map((it) => {
                    const qty = Number(it.quantity || 1);
                    const unitPrice = Number(it.price || 0);
                    return {
                        orderItemId: it.id,
                        productId: it.product_id,
                        variantId: it.variant_id,
                        qty,
                        unitPrice,
                        gross: qty * unitPrice,
                        platformFee: Number(it.resolved_fee_value || 0),
                    };
                }),
            });
        }
    } catch (glError) {
        logger.error("gl:post_order_release_failed", { orderId: order.id, error: String(glError) });
    }

    return order;
}

export async function confirmReceipt(orderId: string) {
    const user = await getCurrentUser();

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.buyer_id, user.id)),
        columns: { id: true, status: true },
    });

    if (!order) {
        throw new Error("Order tidak ditemukan");
    }

    if (order.status !== "DELIVERED") {
        throw new Error("Pesanan belum berstatus DELIVERED");
    }

    const completed = await completeOrder(orderId, false);
    if (!completed) {
        throw new Error("Pesanan tidak dapat diselesaikan saat ini (mungkin sedang dispute).");
    }

    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true };
}

export interface EscrowAutoReleaseResult {
    inspected: number;
    completed: number;
    skipped: number;
    completedOrderIds: string[];
}

export async function runEscrowAutoRelease(): Promise<EscrowAutoReleaseResult> {
    const now = new Date();
    const overdue = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
            and(
                eq(orders.status, "DELIVERED"),
                isNotNull(orders.release_due_at),
                lte(orders.release_due_at, now)
            )
        );

    let completed = 0;
    let skipped = 0;
    const completedOrderIds: string[] = [];

    for (const row of overdue) {
        const result = await completeOrder(row.id, true);
        if (result) {
            completed++;
            completedOrderIds.push(row.id);
        } else {
            skipped++;
        }
    }

    return {
        inspected: overdue.length,
        completed,
        skipped,
        completedOrderIds,
    };
}

