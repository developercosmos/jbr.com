"use server";

import { db } from "@/db";
import { payments, orders } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";
import { isBuyerEligibleForCod } from "@/actions/reputation";
import { recordOrderPayment } from "@/actions/ledger";
import { postOrderPayment } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { getIntegrationCredentials, getSiteConfig } from "@/actions/settings";
import { logger } from "@/lib/logger";

// Xendit API configuration
const XENDIT_API_URL = "https://api.xendit.co";

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
            success: true,
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
        amount: parseFloat(order.total),
        payer_email: order.buyer?.email,
        description: `Pembayaran untuk Order ${order.order_number}${preferredMethod ? ` (${preferredMethod})` : ""}`,
        invoice_duration: 86400, // 24 hours in seconds
        success_redirect_url: `${paymentStatusUrl}?status=success`,
        failure_redirect_url: `${paymentStatusUrl}?status=failed`,
        currency: "IDR",
        items: order.items.map((item: typeof order.items[number]) => ({
            name: item.product?.title || "Produk",
            quantity: item.quantity,
            price: parseFloat(item.price),
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
        success: true,
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

    // Update payment status
    const newStatus = data.status === "PAID" ? "PAID" :
        data.status === "EXPIRED" ? "EXPIRED" :
            data.status === "FAILED" ? "FAILED" : "PENDING";

    await db
        .update(payments)
        .set({
            status: newStatus,
            payment_method: data.payment_method,
            paid_at: data.paid_at ? new Date(data.paid_at) : null,
            updated_at: new Date(),
        })
        .where(eq(payments.id, payment.id));

    // If paid, update order status
    if (data.status === "PAID") {
        await db
            .update(orders)
            .set({
                status: "PAID",
                updated_at: new Date(),
            })
            .where(eq(orders.id, orderId));

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
    }

    revalidatePath("/profile/orders");
    revalidatePath("/seller/orders");

    return { success: true };
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

    // Update local status if changed
    if (invoice.status === "PAID" && payment.status !== "PAID") {
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
