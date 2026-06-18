"use server";

import { db } from "@/db";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { payments, orders, order_items, products, product_variants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import { isBuyerEligibleForCod } from "@/actions/reputation";
import { recordOrderPayment } from "@/actions/ledger";
import { postOrderPayment } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { getIntegrationCredentials, getSiteConfig } from "@/actions/settings";
import { logger } from "@/lib/logger";

// Xendit API configuration. Base URL is overridable via XENDIT_API_URL so a
// local sandbox/simulator can stand in for Xendit during full-cycle testing.
// Defaults to the real API — production behavior is unchanged when unset.
const XENDIT_API_URL = process.env.XENDIT_API_URL?.trim() || "https://api.xendit.co";

async function getXenditSecretKey() {
    if (process.env.XENDIT_SECRET_KEY?.trim()) {
        return process.env.XENDIT_SECRET_KEY.trim();
    }

    const credentials = await getIntegrationCredentials("xendit");
    const apiKey = credentials?.api_key?.trim();

    return apiKey || null;
}

// Helper to get current user
async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

// ============================================
// CREATE XENDIT INVOICE
// ============================================
export async function createPaymentInvoice(orderId: string, preferredMethod?: "BANK_TRANSFER" | "EWALLET" | "COD") {
    try {
        return await createPaymentInvoiceInternal(orderId, preferredMethod);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal membuat pembayaran.");
        logger.warn("payment:create_invoice_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function createPaymentInvoiceInternal(orderId: string, preferredMethod?: "BANK_TRANSFER" | "EWALLET" | "COD") {
    const user = await getCurrentUser();

    // Get order with items
    const order = await db.query.orders.findFirst({
        where: and(eq(orders.id, orderId), eq(orders.buyer_id, user.id)),
        with: {
            items: {
                with: {
                    product: true,
                },
            },
            buyer: true,
            seller: true,
        },
    });

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status !== "PENDING_PAYMENT") {
        throw new Error("Order has already been paid or is not pending payment");
    }

    // RATE-03: gate COD on buyer reputation. Other payment methods skip this check.
    if (preferredMethod === "COD") {
        const eligibility = await isBuyerEligibleForCod(user.id);
        if (!eligibility.eligible) {
            throw new Error(eligibility.reason || "Akun Anda belum memenuhi syarat untuk COD.");
        }

        // True cash-on-delivery: NO online Xendit invoice. Record a pending COD
        // payment and move the order straight to PROCESSING so the seller fulfils;
        // the buyer pays the courier on delivery. Idempotent on a real transition.
        const transitioned = await db
            .update(orders)
            .set({ status: "PROCESSING", updated_at: new Date() })
            .where(and(eq(orders.id, orderId), eq(orders.status, "PENDING_PAYMENT")))
            .returning({ id: orders.id });

        if (transitioned.length > 0) {
            await db.insert(payments).values({
                order_id: orderId,
                amount: order.total,
                status: "PENDING", // settles as cash on delivery; reconciled at receipt
                payment_method: "COD",
            });
            if (order.buyer) {
                await notify({
                    event: "ORDER_CREATED",
                    audience: "buyer",
                    recipientUserId: order.buyer_id,
                    recipientEmail: order.buyer.email,
                    recipientName: order.buyer.name,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    items: order.items.map((item: typeof order.items[number]) => ({
                        title: item.product.title,
                        quantity: item.quantity,
                        price: formatCurrency(parseFloat(item.price) * item.quantity),
                    })),
                    subtotal: formatCurrency(parseFloat(order.subtotal)),
                    shippingCost: formatCurrency(parseFloat(order.shipping_cost || "0")),
                    total: formatCurrency(parseFloat(order.total)),
                });
            }
            // COD has no online payment step → notify the seller now (order is
            // PROCESSING and must be fulfilled; buyer pays the courier on delivery).
            if (order.seller?.email) {
                await notify({
                    event: "ORDER_CREATED",
                    audience: "seller",
                    recipientUserId: order.seller_id,
                    recipientEmail: order.seller.email,
                    recipientName: order.seller.store_name || order.seller.name || "Penjual",
                    orderId: order.id,
                    orderNumber: order.order_number,
                    buyerName: order.buyer?.name || "Pembeli",
                    items: order.items.map((item: typeof order.items[number]) => ({
                        name: item.product.title,
                        quantity: item.quantity,
                        price: parseFloat(item.price) * item.quantity,
                    })),
                    total: parseFloat(order.total),
                });
            }
        }

        revalidatePath("/profile/orders");
        revalidatePath("/seller/orders");
        return {
            success: true as const,
            cod: true,
            redirectUrl: `/profile/orders/${orderId}`,
        };
    }

    // Check if payment already exists
    const existingPayment = await db.query.payments.findFirst({
        where: and(
            eq(payments.order_id, orderId),
            eq(payments.status, "PENDING")
        ),
    });

    if (existingPayment && existingPayment.xendit_invoice_url) {
        return {
            success: true as const,
            invoiceUrl: existingPayment.xendit_invoice_url,
            paymentId: existingPayment.id,
        };
    }

    // Create Xendit invoice
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const xenditSecretKey = await getXenditSecretKey();
    if (!xenditSecretKey) {
        return {
            success: false,
            error: "Metode pembayaran online belum dikonfigurasi. Hubungi admin untuk mengaktifkan Xendit.",
        };
    }

    const siteConfig = await getSiteConfig();
    const paymentStatusUrl = `${siteConfig.app_url}/checkout/payment/${orderId}`;

    const invoiceData = {
        external_id: `order-${order.id}`,
        // IDR is a zero-decimal currency — Xendit expects whole-rupiah integers.
        // order.total is a decimal(12,2) string; round to avoid sending fractions.
        amount: Math.round(parseFloat(order.total)),
        payer_email: order.buyer?.email,
        description: `Pembayaran untuk Order ${order.order_number}${preferredMethod ? ` (${preferredMethod})` : ""}`,
        invoice_duration: 86400, // 24 hours in seconds
        success_redirect_url: `${paymentStatusUrl}?status=success`,
        failure_redirect_url: `${paymentStatusUrl}?status=failed`,
        currency: "IDR",
        items: order.items.map((item: typeof order.items[number]) => ({
            name: item.product?.title || "Produk",
            quantity: item.quantity,
            price: Math.round(parseFloat(item.price)),
        })),
    };

    const response = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${Buffer.from(xenditSecretKey + ":").toString("base64")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
        let errorMessage = "Gagal membuat invoice pembayaran";
        try {
            const errorData = await response.json();
            console.error("Xendit API error:", errorData);
            errorMessage = errorData.message || errorMessage;
        } catch {
            console.error("Xendit API error: non-JSON response", response.status, response.statusText);
        }

        return {
            success: false,
            error: errorMessage,
        };
    }

    const invoice = await response.json();

    // Save payment record
    const [payment] = await db
        .insert(payments)
        .values({
            order_id: orderId,
            xendit_invoice_id: invoice.id,
            xendit_invoice_url: invoice.invoice_url,
            amount: order.total,
            status: "PENDING",
            payment_method: preferredMethod || null,
            expires_at: expiresAt,
        })
        .returning();

    if (order.buyer) {
        await notify({
            event: "ORDER_CREATED",
            audience: "buyer",
            recipientUserId: order.buyer_id,
            recipientEmail: order.buyer.email,
            recipientName: order.buyer.name,
            orderId: order.id,
            orderNumber: order.order_number,
            items: order.items.map((item: typeof order.items[number]) => ({
                title: item.product.title,
                quantity: item.quantity,
                price: formatCurrency(parseFloat(item.price) * item.quantity),
            })),
            subtotal: formatCurrency(parseFloat(order.subtotal)),
            shippingCost: formatCurrency(parseFloat(order.shipping_cost || "0")),
            total: formatCurrency(parseFloat(order.total)),
        });
    }

    revalidatePath("/profile/orders");

    return {
        success: true as const,
        invoiceUrl: invoice.invoice_url,
        paymentId: payment.id,
    };
}

// ============================================
// GET PAYMENT STATUS
// ============================================
export async function getPaymentStatus(orderId: string) {
    const user = await getCurrentUser();

    // Get order
    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
    });

    if (!order) {
        throw new Error("Order not found");
    }

    // Verify access
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
        throw new Error("Unauthorized");
    }

    // Get latest payment
    const payment = await db.query.payments.findFirst({
        where: eq(payments.order_id, orderId),
        orderBy: [desc(payments.created_at)],
    });

    return {
        order,
        payment,
    };
}

// ============================================
// HANDLE XENDIT WEBHOOK (called from API route)
// ============================================
export async function handleXenditWebhook(data: {
    id: string;
    external_id: string;
    status: string;
    payment_method: string;
    paid_at?: string;
}) {
    const orderId = data.external_id.replace("order-", "");

    // Find payment by xendit invoice id
    const payment = await db.query.payments.findFirst({
        where: eq(payments.xendit_invoice_id, data.id),
    });

    if (!payment) {
        console.error("Payment not found for xendit invoice:", data.id);
        return { success: false, error: "Payment not found" };
    }

    // Map Xendit's InvoiceStatus (PENDING | PAID | SETTLED | EXPIRED) to our
    // payment_status enum. SETTLED means funds settled after PAID — also a success.
    // (There is no FAILED status for invoices in the Xendit API.)
    const isPaid = data.status === "PAID" || data.status === "SETTLED";
    const newStatus = isPaid ? "PAID" :
        data.status === "EXPIRED" ? "EXPIRED" : "PENDING";

    await db
        .update(payments)
        .set({
            status: newStatus,
            payment_method: data.payment_method,
            paid_at: data.paid_at ? new Date(data.paid_at) : null,
            updated_at: new Date(),
        })
        .where(eq(payments.id, payment.id));

    // If paid, update order status — idempotently.
    if (isPaid) {
        // Atomic transition: only the FIRST callback to flip the order out of
        // PENDING_PAYMENT runs the money side-effects (ledger + GL + emails).
        // Xendit retries callbacks until it gets a 2xx, and the client-side poller
        // can also fire, so every duplicate MUST be a no-op here.
        const transitioned = await db
            .update(orders)
            .set({
                status: "PAID",
                updated_at: new Date(),
            })
            .where(and(eq(orders.id, orderId), eq(orders.status, "PENDING_PAYMENT")))
            .returning({ id: orders.id });

        if (transitioned.length === 0) {
            // Already processed (or not in a payable state) — idempotent no-op.
            return { success: true as const };
        }

        // Get order with buyer info for email
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, orderId),
            with: {
                buyer: true,
                seller: true,
                items: {
                    with: {
                        product: true,
                    },
                },
            },
        });

        if (order?.buyer) {
            await notify({
                event: "PAYMENT_SUCCESS",
                recipientUserId: order.buyer_id,
                recipientEmail: order.buyer.email,
                recipientName: order.buyer.name,
                orderId: order.id,
                orderNumber: order.order_number,
                paymentMethod: data.payment_method,
                amount: formatCurrency(parseFloat(order.total)),
                paidAt: new Date(data.paid_at || Date.now()).toLocaleString("id-ID"),
            });

            // MON-03: record buyer payment into escrow ledger.
            try {
                await recordOrderPayment({
                    orderId: order.id,
                    buyerId: order.buyer_id,
                    amount: parseFloat(order.total),
                });
            } catch (ledgerError) {
                logger.error("ledger:record_order_payment_failed", { orderId: order.id, error: String(ledgerError) });
            }

            // GL-03: dual-write to PSAK GL (Phase 2). Behind setting flag so we
            // can switch off legacy when GL is canonical.
            try {
                const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
                if (dualWrite) {
                    await postOrderPayment({
                        orderId: order.id,
                        paymentId: payment.id,
                        grossAmount: parseFloat(order.total),
                        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
                        paymentMethod: data.payment_method,
                    });
                }
            } catch (glError) {
                logger.error("gl:post_order_payment_failed", { orderId: order.id, error: String(glError) });
            }
        }

        if (order?.seller) {
            await notify({
                event: "ORDER_CREATED",
                audience: "seller",
                recipientUserId: order.seller_id,
                recipientEmail: order.seller.email,
                recipientName: order.seller.store_name || order.seller.name,
                orderId: order.id,
                orderNumber: order.order_number,
                buyerName: order.buyer?.name || "Pembeli",
                items: order.items.map((item: typeof order.items[number]) => ({
                    name: item.product.title,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                })),
                total: parseFloat(order.total),
            });
        }
    } else if (data.status === "EXPIRED") {
        // Release the stock reserved at order creation — exactly once — by
        // atomically cancelling the still-unpaid order.
        const cancelled = await db
            .update(orders)
            .set({ status: "CANCELLED", updated_at: new Date() })
            .where(and(eq(orders.id, orderId), eq(orders.status, "PENDING_PAYMENT")))
            .returning({ id: orders.id });
        if (cancelled.length > 0) {
            await restockOrder(orderId);
        }
    }

    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true as const };
}

// Restore product/variant stock for every line item of an order. Used when an
// unpaid order is cancelled/expired/failed. Mirrors the decrement in
// createOrderFromCart (products always; variant additionally when present).
async function restockOrder(orderId: string) {
    const items = await db
        .select({
            product_id: order_items.product_id,
            variant_id: order_items.variant_id,
            quantity: order_items.quantity,
        })
        .from(order_items)
        .where(eq(order_items.order_id, orderId));

    for (const item of items) {
        if (item.variant_id) {
            await db
                .update(product_variants)
                .set({ stock: sql`${product_variants.stock} + ${item.quantity}` })
                .where(eq(product_variants.id, item.variant_id));
        } else if (item.product_id) {
            await db
                .update(products)
                .set({ stock: sql`${products.stock} + ${item.quantity}` })
                .where(eq(products.id, item.product_id));
        }
    }
}

// ============================================
// SERVER-SIDE RECONCILIATION (cron)
// ============================================
// Polls Xendit for every still-PENDING, non-expired payment and reconciles its
// status. This guarantees order confirmation even if the webhook is missed/rejected
// AND the buyer never reopens the payment page. handleXenditWebhook is idempotent,
// so re-confirming an already-PAID order is a safe no-op.
export async function reconcilePendingPayments(limit = 100): Promise<{
    inspected: number;
    confirmed: number;
    errors: number;
}> {
    const now = new Date();
    const pending = await db
        .select({ id: payments.id, expires_at: payments.expires_at })
        .from(payments)
        .where(eq(payments.status, "PENDING"))
        .orderBy(desc(payments.created_at))
        .limit(limit);

    let confirmed = 0;
    let errors = 0;
    let inspected = 0;

    for (const p of pending) {
        // Skip invoices that have clearly expired (Xendit will report EXPIRED;
        // we still reconcile those occasionally, but prioritize live ones).
        if (p.expires_at && p.expires_at < new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)) {
            continue;
        }
        inspected++;
        try {
            const result = await checkInvoiceStatus(p.id);
            if (result.status === "PAID") confirmed++;
        } catch (e) {
            errors++;
            logger.error("payments:reconcile_failed", { paymentId: p.id, error: String(e) });
        }
    }

    return { inspected, confirmed, errors };
}

// ============================================
// CHECK XENDIT INVOICE STATUS (for polling)
// ============================================
export async function checkInvoiceStatus(paymentId: string) {
    const payment = await db.query.payments.findFirst({
        where: eq(payments.id, paymentId),
    });

    if (!payment || !payment.xendit_invoice_id) {
        throw new Error("Payment not found");
    }

    const xenditSecretKey = await getXenditSecretKey();
    if (!xenditSecretKey) {
        throw new Error("Xendit API key not configured");
    }

    // Get invoice from Xendit
    const response = await fetch(`${XENDIT_API_URL}/v2/invoices/${payment.xendit_invoice_id}`, {
        method: "GET",
        headers: {
            "Authorization": `Basic ${Buffer.from(xenditSecretKey + ":").toString("base64")}`,
        },
    });

    if (!response.ok) {
        throw new Error("Failed to check invoice status");
    }

    const invoice = await response.json();

    // Update local status if changed. Treat SETTLED like PAID (post-payment
    // settlement), matching handleXenditWebhook's mapping.
    const invoicePaid = invoice.status === "PAID" || invoice.status === "SETTLED";
    if (invoicePaid && payment.status !== "PAID") {
        await handleXenditWebhook({
            id: invoice.id,
            external_id: invoice.external_id,
            status: invoice.status,
            payment_method: invoice.payment_method,
            paid_at: invoice.paid_at,
        });
    }

    return {
        status: invoice.status,
        paymentMethod: invoice.payment_method,
        paidAt: invoice.paid_at,
    };
}
