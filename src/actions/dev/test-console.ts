"use server";

// ⚠️ DEV/TEST TOOLING ONLY. Every export hard-fails in production and requires an
// ADMIN session. This drives an order through its full lifecycle without needing
// the real Xendit/courier, so a tester can exercise one complete cycle locally.

import { db } from "@/db";
import { orders, payments, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { handleXenditWebhook } from "@/actions/payments";
import { INTERNAL_CALL_TOKEN } from "@/lib/internal-guard";
import { runEscrowAutoRelease } from "@/actions/escrow";
import { notify } from "@/lib/notify";

const ESCROW_RELEASE_HOURS = Number(process.env.ESCROW_RELEASE_HOURS || 72);

async function assertDevAdmin() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("Test console dinonaktifkan di production.");
    }
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { role: true },
    });
    if (u?.role !== "ADMIN") throw new Error("Khusus admin.");
    return session.user;
}

export interface TestOrderRow {
    id: string;
    orderNumber: string;
    status: string;
    total: string;
    buyerName: string;
    sellerName: string;
    trackingNumber: string | null;
    releaseDueAt: string | null;
    createdAt: string;
}

function firstRel<T>(v: T | T[] | null | undefined): T | null {
    if (Array.isArray(v)) return v[0] ?? null;
    return v ?? null;
}

export async function listRecentOrdersForTest(limit = 30): Promise<TestOrderRow[]> {
    await assertDevAdmin();
    const rows = await db.query.orders.findMany({
        orderBy: [desc(orders.created_at)],
        limit,
        with: {
            buyer: { columns: { name: true, email: true } },
            seller: { columns: { name: true, store_name: true } },
        },
    });
    return rows.map((o) => {
        const buyer = firstRel(o.buyer);
        const seller = firstRel(o.seller);
        return {
            id: o.id,
            orderNumber: o.order_number,
            status: o.status,
            total: o.total,
            buyerName: buyer?.name || buyer?.email || "—",
            sellerName: seller?.store_name || seller?.name || "—",
            trackingNumber: o.tracking_number ?? null,
            releaseDueAt: o.release_due_at ? o.release_due_at.toISOString() : null,
            createdAt: o.created_at.toISOString(),
        };
    });
}

export type TestAction = "PAY" | "PROCESS" | "SHIP" | "DELIVER" | "RELEASE" | "CANCEL";

export async function testAdvanceOrder(
    orderId: string,
    action: TestAction
): Promise<{ success: boolean; message: string }> {
    await assertDevAdmin();

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        with: { buyer: { columns: { id: true, email: true, name: true } } },
    });
    if (!order) return { success: false, message: "Order tidak ditemukan." };
    const buyer = firstRel(order.buyer);

    const done = (message: string) => {
        revalidatePath("/dev/test-console");
        revalidatePath(`/seller/orders/${orderId}`);
        revalidatePath(`/profile/orders/${orderId}`);
        return { success: true, message };
    };

    switch (action) {
        case "PAY": {
            if (order.status !== "PENDING_PAYMENT") {
                return { success: false, message: `PAY hanya untuk PENDING_PAYMENT (sekarang ${order.status}).` };
            }
            // Ensure a payment row with an invoice id exists, then drive the REAL
            // webhook handler so the ledger/GL/notify path is exercised faithfully.
            let payment = await db.query.payments.findFirst({ where: eq(payments.order_id, orderId) });
            let invoiceId = payment?.xendit_invoice_id ?? null;
            if (!payment) {
                invoiceId = `sim-${orderId}`;
                await db.insert(payments).values({
                    order_id: orderId,
                    xendit_invoice_id: invoiceId,
                    amount: order.total,
                    status: "PENDING",
                    payment_method: "BANK_TRANSFER",
                });
            } else if (!invoiceId) {
                invoiceId = `sim-${orderId}`;
                await db.update(payments).set({ xendit_invoice_id: invoiceId, updated_at: new Date() }).where(eq(payments.id, payment.id));
            }
            const res = await handleXenditWebhook({
                id: invoiceId!,
                external_id: `order-${orderId}`,
                status: "PAID",
                payment_method: "BANK_TRANSFER",
                paid_at: new Date().toISOString(),
            }, INTERNAL_CALL_TOKEN);
            return res.success ? done("Order PAID (lewat handler webhook + ledger).") : { success: false, message: res.error || "Gagal." };
        }

        case "PROCESS": {
            const upd = await db
                .update(orders)
                .set({ status: "PROCESSING", updated_at: new Date() })
                .where(and(eq(orders.id, orderId), eq(orders.status, "PAID")))
                .returning({ id: orders.id });
            return upd.length ? done("Order → PROCESSING.") : { success: false, message: `PROCESS butuh status PAID (sekarang ${order.status}).` };
        }

        case "SHIP": {
            if (order.status !== "PAID" && order.status !== "PROCESSING") {
                return { success: false, message: `SHIP butuh PAID/PROCESSING (sekarang ${order.status}).` };
            }
            const resi = `SIM${Date.now().toString().slice(-10)}`;
            await db
                .update(orders)
                .set({ status: "SHIPPED", tracking_number: resi, shipping_provider: "JNE", shipped_at: new Date(), updated_at: new Date() })
                .where(eq(orders.id, orderId));
            if (buyer?.email) {
                await notify({
                    event: "ORDER_SHIPPED",
                    recipientUserId: order.buyer_id,
                    recipientEmail: buyer.email,
                    recipientName: buyer.name ?? "Pembeli",
                    orderId,
                    orderNumber: order.order_number,
                    trackingNumber: resi,
                    shippingProvider: "JNE",
                    trackingUrl: `https://cekresi.com/?noresi=${resi}`,
                });
            }
            return done(`Order → SHIPPED (resi ${resi}).`);
        }

        case "DELIVER": {
            if (order.status !== "SHIPPED") {
                return { success: false, message: `DELIVER butuh SHIPPED (sekarang ${order.status}).` };
            }
            const due = new Date(Date.now() + ESCROW_RELEASE_HOURS * 3600 * 1000);
            await db
                .update(orders)
                .set({ status: "DELIVERED", release_due_at: due, updated_at: new Date() })
                .where(eq(orders.id, orderId));
            if (buyer?.email) {
                await notify({
                    event: "ORDER_DELIVERED",
                    audience: "buyer",
                    recipientUserId: order.buyer_id,
                    recipientEmail: buyer.email,
                    recipientName: buyer.name ?? "Pembeli",
                    orderId,
                    orderNumber: order.order_number,
                });
            }
            return done(`Order → DELIVERED (escrow rilis otomatis dalam ${ESCROW_RELEASE_HOURS} jam).`);
        }

        case "RELEASE": {
            if (order.status !== "DELIVERED") {
                return { success: false, message: `RELEASE butuh DELIVERED (sekarang ${order.status}).` };
            }
            // Fast-forward the escrow clock, then run the REAL auto-release sweep.
            await db
                .update(orders)
                .set({ release_due_at: new Date(Date.now() - 1000), updated_at: new Date() })
                .where(eq(orders.id, orderId));
            const r = await runEscrowAutoRelease(INTERNAL_CALL_TOKEN);
            return done(`Escrow auto-release dijalankan: ${JSON.stringify(r)}.`);
        }

        case "CANCEL": {
            const upd = await db
                .update(orders)
                .set({ status: "CANCELLED", updated_at: new Date() })
                .where(and(eq(orders.id, orderId), inArray(orders.status, ["PENDING_PAYMENT", "PAID", "PROCESSING"])))
                .returning({ id: orders.id });
            return upd.length
                ? done("Order → CANCELLED. (Catatan: stok tidak di-restock di test cancel.)")
                : { success: false, message: `CANCEL tidak diizinkan dari status ${order.status}.` };
        }
        default:
            return { success: false, message: "Aksi tidak dikenal." };
    }
}
