"use server";

import { db } from "@/db";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { orders, disputes } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, inArray, isNotNull, lte, desc, or, ne } from "drizzle-orm";
import { payments } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { recomputeSellerRating } from "@/actions/reputation";
import { recordOrderRelease, recordOrderPayment } from "@/actions/ledger";
import { postOrderRelease, postOrderPayment } from "@/actions/accounting/posting";
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
            payment_method: true,
            cod_collected_at: true,
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

    // COD: cash is collected by the courier on delivery, so the buyer payment is
    // recognized at completion — but ONLY once collection is confirmed
    // (cod_collected_at, set by the buyer's confirmReceipt). A logistics
    // "delivered" status / the auto-release timer alone must NOT release funds for
    // cash the platform never received. Fund the escrow BEFORE the atomic flip so
    // a funding failure leaves the order DELIVERED (retryable), never
    // COMPLETED-but-unreleased. Idempotent on ORDER_PAYMENT:<orderId>.
    if (order.payment_method === "COD") {
        if (!order.cod_collected_at) return null; // wait for cash-collected signal
        await recordOrderPayment({
            orderId: order.id,
            buyerId: order.buyer_id,
            amount: parseFloat(order.total),
        });
        const codPayment = await db.query.payments.findFirst({
            where: and(eq(payments.order_id, order.id), eq(payments.payment_method, "COD")),
            orderBy: [desc(payments.created_at)],
            columns: { id: true },
        });
        if (codPayment) {
            await db
                .update(payments)
                .set({ status: "PAID", paid_at: new Date(), updated_at: new Date() })
                .where(eq(payments.id, codPayment.id));
            const dualWriteCod = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
            if (dualWriteCod) {
                await postOrderPayment({
                    orderId: order.id,
                    paymentId: codPayment.id,
                    grossAmount: parseFloat(order.total),
                    paidAt: new Date(),
                    paymentMethod: "COD",
                });
            }
        }
    }

    // Atomic DELIVERED→COMPLETED transition. confirmReceipt (buyer) and the
    // auto-release cron can fire concurrently for the same order; only the call
    // that actually flips the row proceeds to release escrow. The loser gets 0
    // rows back and returns null — so funds are released exactly once.
    const won = await db
        .update(orders)
        .set({
            status: "COMPLETED",
            release_due_at: null,
            updated_at: new Date(),
        })
        .where(and(eq(orders.id, orderId), eq(orders.status, "DELIVERED")))
        .returning({ id: orders.id });

    if (won.length === 0) return null;

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
    try {
        return await confirmReceiptInternal(orderId);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyelesaikan pesanan.");
        logger.warn("escrow:confirm_receipt_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function confirmReceiptInternal(orderId: string) {
    const user = await getCurrentUser();

    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.buyer_id, user.id)),
        columns: { id: true, status: true, payment_method: true, cod_collected_at: true },
    });

    if (!order) {
        throw new Error("Order tidak ditemukan");
    }

    if (order.status !== "DELIVERED") {
        throw new Error("Pesanan belum berstatus DELIVERED");
    }

    // For COD, the buyer confirming receipt IS the cash-collected signal (they paid
    // the courier on delivery) — record it so completeOrder may recognize payment +
    // release to the seller. Prepaid orders ignore this field.
    if (order.payment_method === "COD" && !order.cod_collected_at) {
        await db
            .update(orders)
            .set({ cod_collected_at: new Date(), updated_at: new Date() })
            .where(eq(orders.id, orderId));
    }

    const completed = await completeOrder(orderId, false);
    if (!completed) {
        throw new Error("Pesanan tidak dapat diselesaikan saat ini (mungkin sedang dispute).");
    }

    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true as const };
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
                lte(orders.release_due_at, now),
                // COD never auto-releases on the timer alone — it needs a confirmed
                // cash-collected signal (cod_collected_at). Prepaid is unaffected.
                or(ne(orders.payment_method, "COD"), isNotNull(orders.cod_collected_at))
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

