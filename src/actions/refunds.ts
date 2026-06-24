"use server";

import { db } from "@/db";
import { orders, order_items, products, product_variants, users, payments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordOrderRefund } from "@/actions/ledger";
import { reverseAttributionForRefund } from "@/actions/affiliate";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";
import { postOrderRefund } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { notify } from "@/lib/notify";
import { logger } from "@/lib/logger";

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, role: true },
    });
    if (!u || u.role !== "ADMIN") throw new Error("Admin access required");
    return u;
}

// Orders whose funds have left the buyer and can therefore be refunded.
const REFUNDABLE_STATUSES = ["PAID", "PACKING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

/**
 * Admin-gated full refund for an order. Idempotent and atomic:
 *  1. Atomically flips a refundable order → REFUNDED (loser of any race exits).
 *  2. Restocks every line item.
 *  3. Reverses the legacy escrow ledger (recordOrderRefund is keyed on orderId).
 *  4. Reverses the PSAK GL (postOrderRefund, idempotencyKey ORDER_REFUND:<id>).
 *  5. Reverses any affiliate commission for the order.
 *  6. Notifies the buyer.
 *
 * NOTE: this records the refund obligation in our books and releases inventory.
 * The actual money movement back to the buyer (Xendit refund API or a manual
 * bank transfer) is an operational step tracked via postOrderRefundDisbursement;
 * wire the gateway call here once the Xendit refund product is enabled.
 */
export async function refundOrder(input: { orderId: string; reason?: string }) {
    await requireAdmin();

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.orderId),
        columns: { id: true, order_number: true, status: true, buyer_id: true, total: true, payment_method: true },
    });
    if (!order) throw new Error("Pesanan tidak ditemukan");

    if (!REFUNDABLE_STATUSES.includes(order.status as (typeof REFUNDABLE_STATUSES)[number])) {
        throw new Error(`Pesanan berstatus ${order.status} tidak dapat di-refund`);
    }

    return applyRefund(order);
}

/**
 * Core refund mechanics: atomic flip → restock → ledger/GL/affiliate reversal →
 * notify buyer. Shared by admin {@link refundOrder} and {@link sellerCancelOrder}.
 * The atomic guard makes it idempotent and race-safe regardless of caller.
 */
async function applyRefund(order: {
    id: string;
    order_number: string;
    status: string;
    buyer_id: string;
    total: string;
    payment_method: string;
}) {
    // Atomic guard: only the first caller that flips a still-refundable order wins.
    const won = await db
        .update(orders)
        .set({ status: "REFUNDED", updated_at: new Date() })
        .where(
            and(
                eq(orders.id, order.id),
                sql`${orders.status} IN ('PAID','PACKING','PROCESSING','SHIPPED','DELIVERED')`
            )
        )
        .returning({ id: orders.id });

    if (won.length === 0) {
        // Someone else already refunded it — idempotent no-op.
        return { success: true, alreadyRefunded: true };
    }

    // Restock line items (atomic increments).
    const items = await db
        .select({
            product_id: order_items.product_id,
            variant_id: order_items.variant_id,
            quantity: order_items.quantity,
        })
        .from(order_items)
        .where(eq(order_items.order_id, order.id));

    for (const item of items) {
        if (item.variant_id) {
            await db
                .update(product_variants)
                .set({ stock: sql`${product_variants.stock} + ${item.quantity}`, updated_at: new Date() })
                .where(eq(product_variants.id, item.variant_id));
        } else if (item.product_id) {
            await db
                .update(products)
                .set({ stock: sql`${products.stock} + ${item.quantity}` })
                .where(eq(products.id, item.product_id));
        }
    }

    const amount = parseFloat(order.total);

    // Only reverse the MONEY legs if the buyer actually paid. Prepaid always paid.
    // COD funds escrow only at completion (a PAID payments row); refunding an
    // unpaid COD order (cancelled before delivery) must NOT book a refund payable
    // or reverse escrow that was never funded — that desyncs the books. Restock +
    // status flip + affiliate reversal + notify still apply below.
    let buyerPaid = order.payment_method !== "COD";
    if (!buyerPaid) {
        const paid = await db.query.payments.findFirst({
            where: and(eq(payments.order_id, order.id), eq(payments.status, "PAID")),
            columns: { id: true },
        });
        buyerPaid = !!paid;
    }

    if (buyerPaid) {
        // Reverse legacy escrow ledger (idempotent: deterministic groupId on orderId).
        try {
            await recordOrderRefund({ orderId: order.id, buyerId: order.buyer_id, amount });
        } catch (e) {
            logger.error("refund:legacy_ledger_failed", { orderId: order.id, error: String(e) });
        }

        // Reverse PSAK GL (idempotent: idempotencyKey ORDER_REFUND:<id>).
        try {
            const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
            if (dualWrite) {
                await postOrderRefund({ orderId: order.id, refundId: order.id, amount });
            }
        } catch (e) {
            logger.error("refund:gl_failed", { orderId: order.id, error: String(e) });
        }
    }

    // Reverse affiliate commission tied to this order (if any).
    try {
        await reverseAttributionForRefund(order.id, INTERNAL_CALL_TOKEN, `Refund order ${order.order_number}`);
    } catch (e) {
        logger.error("refund:affiliate_reverse_failed", { orderId: order.id, error: String(e) });
    }

    try {
        await notify({
            event: "ORDER_REFUNDED",
            audience: "buyer",
            recipientUserId: order.buyer_id,
            orderId: order.id,
            orderNumber: order.order_number,
        });
    } catch {
        // notification non-critical
    }

    revalidatePath("/admin/disputes");
    revalidatePath("/admin/orders");
    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true, refundedAmount: amount };
}

/**
 * Seller-initiated cancellation of a PRE-SHIPMENT paid order (status PAID or
 * PROCESSING), e.g. the seller ran out of stock. Restocks, reverses the escrow
 * ledger (records the refund obligation), and notifies the buyer; status → REFUNDED.
 *
 * NOTE: like {@link refundOrder}, this records the refund in our books and
 * releases inventory — the actual money-back to the buyer (Xendit refund API /
 * manual transfer) is still an operational step until the gateway call is wired.
 * After SHIPPED a cancellation must go through the dispute flow instead.
 */
export async function sellerCancelOrder(input: { orderId: string }) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { success: false as const, error: "Tidak terautentikasi" };

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, input.orderId),
        columns: {
            id: true,
            order_number: true,
            status: true,
            buyer_id: true,
            seller_id: true,
            total: true,
            payment_method: true,
            biteship_order_id: true,
        },
    });
    if (!order) return { success: false as const, error: "Pesanan tidak ditemukan" };
    if (order.seller_id !== session.user.id) {
        return { success: false as const, error: "Anda bukan penjual pesanan ini" };
    }
    if (order.status !== "PAID" && order.status !== "PACKING" && order.status !== "PROCESSING") {
        return {
            success: false as const,
            error: "Pesanan hanya dapat dibatalkan sebelum dikirim (status Dibayar/Dikemas/Diproses).",
        };
    }
    if (order.biteship_order_id) {
        return {
            success: false as const,
            error: "Pickup kurir sudah dibooking — batalkan booking kurir terlebih dahulu.",
        };
    }

    await applyRefund({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        buyer_id: order.buyer_id,
        total: order.total,
        payment_method: order.payment_method,
    });
    return { success: true as const };
}
