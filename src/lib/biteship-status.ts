// Shared Biteship → order state transition logic, used by BOTH the webhook
// receiver (/api/webhooks/biteship) and the seller's manual "refresh status"
// action. Lives in lib/ so it can be imported from a route handler and a
// "use server" actions file without becoming a public server action itself.
//
// All transitions are GUARDED conditional updates (WHERE status IN ...) so a
// replayed/duplicated webhook or a concurrent manual sync is idempotent.

import { db } from "@/db";
import { notifications, orders } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { logger } from "@/lib/logger";

/** Biteship statuses that mean the parcel is with the courier network. */
const PICKED_STATUSES = new Set(["picked", "dropping_off", "return_in_transit"]);
/** Terminal failure statuses — booking is dead, seller must rebook or ship manually. */
const FAILED_STATUSES = new Set(["cancelled", "rejected", "courier_not_found", "disposed", "returned"]);

function trackingUrlFor(provider: string | null, trackingNumber: string | null): string | undefined {
    if (!trackingNumber) return undefined;
    const p = (provider ?? "").toLowerCase();
    if (p.includes("jne")) return `https://www.jne.co.id/id/tracking/trace/${trackingNumber}`;
    if (p.includes("j&t") || p.includes("jnt")) return `https://www.jet.co.id/track/${trackingNumber}`;
    if (p.includes("sicepat")) return `https://www.sicepat.com/checkAwb/${trackingNumber}`;
    if (p.includes("anteraja")) return `https://anteraja.id/tracking/${trackingNumber}`;
    if (p.includes("pos")) return `https://www.posindonesia.co.id/id/tracking?barcode=${trackingNumber}`;
    return `https://cekresi.com/?noresi=${trackingNumber}`;
}

export interface BiteshipStatusUpdateResult {
    handled: boolean;
    orderId?: string;
    action?: "shipped" | "delivered" | "failed" | "waybill" | "noop";
}

/**
 * Apply a Biteship status (+ optional waybill) to the matching order.
 * Never throws — webhook handlers must stay 200-fast; errors are logged.
 */
export async function applyBiteshipStatusUpdate(params: {
    biteshipOrderId: string;
    status: string;
    waybillId?: string | null;
}): Promise<BiteshipStatusUpdateResult> {
    const status = (params.status || "").toLowerCase().trim();
    const order = await db.query.orders.findFirst({
        where: eq(orders.biteship_order_id, params.biteshipOrderId),
        with: { buyer: { columns: { email: true, name: true } } },
    });
    if (!order) {
        logger.warn?.("biteship:unknown_order", { biteshipOrderId: params.biteshipOrderId, status });
        return { handled: false };
    }

    try {
        // Waybill backfill is always safe and independent of status transitions.
        if (params.waybillId && params.waybillId !== order.tracking_number) {
            await db
                .update(orders)
                .set({ tracking_number: params.waybillId, updated_at: new Date() })
                .where(eq(orders.id, order.id));
        }
        const trackingNumber = params.waybillId ?? order.tracking_number;

        if (PICKED_STATUSES.has(status)) {
            const [updated] = await db
                .update(orders)
                .set({ status: "SHIPPED", shipped_at: new Date(), updated_at: new Date() })
                .where(and(eq(orders.id, order.id), inArray(orders.status, ["PAID", "PROCESSING"])))
                .returning({ id: orders.id });
            if (updated && order.buyer) {
                await notify({
                    event: "ORDER_SHIPPED",
                    recipientUserId: order.buyer_id,
                    recipientEmail: order.buyer.email,
                    recipientName: order.buyer.name,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    trackingNumber: trackingNumber ?? "(menunggu resi dari kurir)",
                    shippingProvider: order.shipping_provider ?? "Biteship",
                    trackingUrl: trackingUrlFor(order.shipping_provider, trackingNumber) ?? "https://cekresi.com",
                });
            }
            return { handled: true, orderId: order.id, action: updated ? "shipped" : "noop" };
        }

        if (status === "delivered") {
            // Mirror confirmDelivery: arm the escrow auto-release timer. Allow the
            // PAID/PROCESSING → DELIVERED jump too (in case the "picked" event was
            // missed) with a shipped_at backfill.
            const releaseHours = Number(process.env.ESCROW_RELEASE_HOURS || 72);
            const releaseDueAt = new Date(Date.now() + releaseHours * 60 * 60 * 1000);
            const [updated] = await db
                .update(orders)
                .set({
                    status: "DELIVERED",
                    release_due_at: releaseDueAt,
                    shipped_at: order.shipped_at ?? new Date(),
                    updated_at: new Date(),
                })
                .where(and(eq(orders.id, order.id), inArray(orders.status, ["PAID", "PROCESSING", "SHIPPED"])))
                .returning({ id: orders.id });
            if (updated) {
                if (order.buyer) {
                    await notify({
                        event: "ORDER_DELIVERED",
                        audience: "buyer",
                        recipientUserId: order.buyer_id,
                        recipientEmail: order.buyer.email,
                        recipientName: order.buyer.name,
                        orderId: order.id,
                        orderNumber: order.order_number,
                    });
                }
                await notify({
                    event: "ORDER_DELIVERED",
                    audience: "seller",
                    recipientUserId: order.seller_id,
                    orderId: order.id,
                    orderNumber: order.order_number,
                });
            }
            return { handled: true, orderId: order.id, action: updated ? "delivered" : "noop" };
        }

        if (FAILED_STATUSES.has(status)) {
            // Before pickup: free the order so the seller can rebook (or ship
            // manually). After SHIPPED: keep everything for investigation.
            const [reverted] = await db
                .update(orders)
                .set({ biteship_order_id: null, updated_at: new Date() })
                .where(and(eq(orders.id, order.id), inArray(orders.status, ["PAID", "PROCESSING"])))
                .returning({ id: orders.id });
            await db
                .insert(notifications)
                .values({
                    user_id: order.seller_id,
                    type: "SYSTEM",
                    title: "Pickup Biteship Gagal/Dibatalkan",
                    message: `Pesanan #${order.order_number}: status kurir "${status}". ${reverted ? "Silakan booking ulang atau kirim manual." : "Periksa pengiriman ini di dashboard Biteship."}`,
                    idempotency_key: `BITESHIP_FAIL:${order.id}:${status}`,
                    data: { order_id: order.id, biteship_status: status },
                })
                .onConflictDoNothing();
            return { handled: true, orderId: order.id, action: "failed" };
        }

        // confirmed / scheduled / allocated / picking_up etc: informational only.
        return { handled: true, orderId: order.id, action: params.waybillId ? "waybill" : "noop" };
    } catch (e) {
        logger.error?.("biteship:apply_status_failed", {
            orderId: order.id,
            status,
            error: e instanceof Error ? e.message : String(e),
        });
        return { handled: false, orderId: order.id };
    }
}
