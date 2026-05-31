"use server";

import { db } from "@/db";
import { orders, order_items, products, product_variants, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordOrderRefund } from "@/actions/ledger";
import { reverseAttributionForRefund } from "@/actions/affiliate";
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
const REFUNDABLE_STATUSES = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

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
        columns: { id: true, order_number: true, status: true, buyer_id: true, total: true },
    });
    if (!order) throw new Error("Pesanan tidak ditemukan");

    if (!REFUNDABLE_STATUSES.includes(order.status as (typeof REFUNDABLE_STATUSES)[number])) {
        throw new Error(`Pesanan berstatus ${order.status} tidak dapat di-refund`);
    }

    // Atomic guard: only the first caller that flips a still-refundable order wins.
    const won = await db
        .update(orders)
        .set({ status: "REFUNDED", updated_at: new Date() })
        .where(
            and(
                eq(orders.id, input.orderId),
                sql`${orders.status} IN ('PAID','PROCESSING','SHIPPED','DELIVERED')`
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
        .where(eq(order_items.order_id, input.orderId));

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

    // Reverse affiliate commission tied to this order (if any).
    try {
        await reverseAttributionForRefund(order.id, `Refund order ${order.order_number}`);
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
