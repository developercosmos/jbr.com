"use server";

import { db } from "@/db";
import { payments, orders, order_items, users, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendOrderConfirmationEmail, sendPaymentSuccessEmail } from "@/lib/email";

// Xendit API configuration
const XENDIT_SECRET_KEY = process.env.XENDIT_SECRET_KEY;
const XENDIT_API_URL = "https://api.xendit.co";

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

// Helper to format currency
function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

// ============================================
// CREATE XENDIT INVOICE
// ============================================
export async function createPaymentInvoice(orderId: string) {
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

    const invoiceData = {
        external_id: `order-${order.id}`,
        amount: parseFloat(order.total),
        payer_email: order.buyer?.email,
        description: `Pembayaran untuk Order ${order.order_number}`,
        invoice_duration: 86400, // 24 hours in seconds
        success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/payment/${orderId}?status=success`,
        failure_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/payment/${orderId}?status=failed`,
        currency: "IDR",
        items: order.items.map((item: typeof order.items[number]) => ({
            name: item.product.title,
            quantity: item.quantity,
            price: parseFloat(item.price),
        })),
    };

    if (!XENDIT_SECRET_KEY) {
        throw new Error("Xendit API key not configured");
    }

    const response = await fetch(`${XENDIT_API_URL}/v2/invoices`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${Buffer.from(XENDIT_SECRET_KEY + ":").toString("base64")}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(invoiceData),
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Xendit API error:", errorData);
        throw new Error(errorData.message || "Failed to create invoice");
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
            expires_at: expiresAt,
        })
        .returning();

    // Send order confirmation email
    if (order.buyer) {
        await sendOrderConfirmationEmail({
            orderNumber: order.order_number,
            buyerName: order.buyer.name,
            buyerEmail: order.buyer.email,
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
            },
        });

        if (order?.buyer) {
            // Send payment success email
            await sendPaymentSuccessEmail({
                orderNumber: order.order_number,
                buyerName: order.buyer.name,
                buyerEmail: order.buyer.email,
                paymentMethod: data.payment_method,
                amount: formatCurrency(parseFloat(order.total)),
                paidAt: new Date(data.paid_at || Date.now()).toLocaleString("id-ID"),
            });

            // Create notification for buyer
            await db.insert(notifications).values({
                user_id: order.buyer_id,
                type: "PAYMENT_SUCCESS",
                title: "Pembayaran Berhasil",
                message: `Pembayaran untuk pesanan ${order.order_number} telah diterima. Pesanan sedang diproses.`,
                data: { order_id: orderId, order_number: order.order_number },
            });

            // Create notification for seller
            await db.insert(notifications).values({
                user_id: order.seller_id,
                type: "ORDER_CREATED",
                title: "Pesanan Baru",
                message: `Ada pesanan baru ${order.order_number} yang perlu diproses.`,
                data: { order_id: orderId, order_number: order.order_number },
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

    if (!XENDIT_SECRET_KEY) {
        throw new Error("Xendit API key not configured");
    }

    // Get invoice from Xendit
    const response = await fetch(`${XENDIT_API_URL}/v2/invoices/${payment.xendit_invoice_id}`, {
        method: "GET",
        headers: {
            "Authorization": `Basic ${Buffer.from(XENDIT_SECRET_KEY + ":").toString("base64")}`,
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
