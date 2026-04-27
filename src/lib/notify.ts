"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import {
    sendNewOrderNotificationToSeller,
    sendOrderConfirmationEmail,
    sendOrderDeliveredEmail,
    sendPaymentSuccessEmail,
    sendShippingNotificationEmail,
} from "@/lib/email";
import { enqueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { eq } from "drizzle-orm";

type NotifyInput =
    | {
        event: "ORDER_CREATED";
        audience: "buyer";
        recipientUserId: string;
        recipientEmail: string;
        recipientName: string | null;
        orderId: string;
        orderNumber: string;
        items: Array<{ title: string; quantity: number; price: string }>;
        subtotal: string;
        shippingCost: string;
        total: string;
        idempotencyKey?: string;
    }
    | {
        event: "ORDER_CREATED";
        audience: "seller";
        recipientUserId: string;
        recipientEmail: string;
        recipientName: string;
        orderId: string;
        orderNumber: string;
        buyerName: string;
        items: Array<{ name: string; quantity: number; price: number }>;
        total: number;
        idempotencyKey?: string;
    }
    | {
        event: "PAYMENT_SUCCESS";
        recipientUserId: string;
        recipientEmail: string;
        recipientName: string | null;
        orderId: string;
        orderNumber: string;
        paymentMethod: string;
        amount: string;
        paidAt: string;
        idempotencyKey?: string;
    }
    | {
        event: "ORDER_SHIPPED";
        recipientUserId: string;
        recipientEmail: string;
        recipientName: string;
        orderId: string;
        orderNumber: string;
        trackingNumber: string;
        shippingProvider: string;
        trackingUrl: string;
        idempotencyKey?: string;
    }
    | {
        event: "ORDER_DELIVERED";
        audience: "buyer" | "seller";
        recipientUserId: string;
        recipientEmail?: string;
        recipientName?: string;
        orderId: string;
        orderNumber: string;
        idempotencyKey?: string;
    }
    | {
        event: "ORDER_COMPLETED";
        audience: "buyer" | "seller";
        recipientUserId: string;
        orderId: string;
        orderNumber: string;
        autoReleased: boolean;
        idempotencyKey?: string;
    }
    | {
        event: "REVIEW_RECEIVED";
        recipientUserId: string;
        actorName: string;
        productId: string;
        productTitle: string;
        reviewId: string;
        rating: number;
        idempotencyKey?: string;
    }
    | {
        event: "REVIEW_REPLY";
        recipientUserId: string;
        reviewId: string;
        productId: string;
        idempotencyKey?: string;
    }
    | {
        event: "DISPUTE_OPENED";
        audience: "buyer" | "seller" | "admin";
        recipientUserId: string;
        disputeId: string;
        orderId: string;
        orderNumber: string;
        disputeType: string;
        idempotencyKey?: string;
    }
    | {
        event: "DISPUTE_UPDATED";
        audience: "buyer" | "seller" | "admin";
        recipientUserId: string;
        disputeId: string;
        orderId: string;
        orderNumber: string;
        status: string;
        idempotencyKey?: string;
    }
    | {
        event: "OFFER_RECEIVED";
        recipientUserId: string;
        offerId: string;
        productTitle: string;
        amount: string;
        actorName: string;
        round: number;
        idempotencyKey?: string;
    }
    | {
        event: "OFFER_ACCEPTED";
        recipientUserId: string;
        offerId: string;
        productTitle: string;
        amount: string;
        idempotencyKey?: string;
    };

function getIdempotencyKey(input: NotifyInput) {
    if (input.idempotencyKey) {
        return input.idempotencyKey;
    }

    switch (input.event) {
        case "ORDER_CREATED":
            return `${input.event}:${input.orderId}:${input.audience}`;
        case "PAYMENT_SUCCESS":
            return `${input.event}:${input.orderId}:${input.recipientUserId}`;
        case "ORDER_SHIPPED":
            return `${input.event}:${input.orderId}:${input.recipientUserId}`;
        case "ORDER_DELIVERED":
            return `${input.event}:${input.orderId}:${input.audience}`;
        case "ORDER_COMPLETED":
            return `${input.event}:${input.orderId}:${input.audience}`;
        case "REVIEW_RECEIVED":
            return `${input.event}:${input.reviewId}:${input.recipientUserId}`;
        case "REVIEW_REPLY":
            return `${input.event}:${input.reviewId}:${input.recipientUserId}`;
        case "DISPUTE_OPENED":
            return `${input.event}:${input.disputeId}:${input.audience}:${input.recipientUserId}`;
        case "DISPUTE_UPDATED":
            return `${input.event}:${input.disputeId}:${input.status}:${input.recipientUserId}`;
        case "OFFER_RECEIVED":
            return `${input.event}:${input.offerId}:${input.recipientUserId}`;
        case "OFFER_ACCEPTED":
            return `${input.event}:${input.offerId}:${input.recipientUserId}`;
    }
}

export async function notify(input: NotifyInput) {
    const idempotencyKey = getIdempotencyKey(input);

    const existing = await db.query.notifications.findFirst({
        where: eq(notifications.idempotency_key, idempotencyKey),
    });

    if (existing) {
        return { notification: existing, duplicate: true };
    }

    let type: typeof notifications.$inferInsert.type;
    let title: string;
    let message: string;
    let data: Record<string, unknown>;
    let emailPromise: Promise<boolean> | null = null;

    switch (input.event) {
        case "ORDER_CREATED":
            type = "ORDER_CREATED";
            title = input.audience === "buyer" ? "Pesanan Dibuat" : "Pesanan Baru";
            message = input.audience === "buyer"
                ? `Pesanan ${input.orderNumber} berhasil dibuat dan menunggu pembayaran.`
                : `Ada pesanan baru ${input.orderNumber} yang perlu diproses.`;
            data = { order_id: input.orderId, order_number: input.orderNumber };
            emailPromise = input.audience === "buyer"
                ? sendOrderConfirmationEmail({
                    orderNumber: input.orderNumber,
                    buyerName: input.recipientName,
                    buyerEmail: input.recipientEmail,
                    items: input.items,
                    subtotal: input.subtotal,
                    shippingCost: input.shippingCost,
                    total: input.total,
                })
                : sendNewOrderNotificationToSeller(
                    input.recipientEmail,
                    input.recipientName,
                    input.orderNumber,
                    input.buyerName,
                    input.items,
                    input.total
                );
            break;
        case "PAYMENT_SUCCESS":
            type = "PAYMENT_SUCCESS";
            title = "Pembayaran Berhasil";
            message = `Pembayaran untuk pesanan ${input.orderNumber} telah diterima. Pesanan sedang diproses.`;
            data = { order_id: input.orderId, order_number: input.orderNumber };
            emailPromise = sendPaymentSuccessEmail({
                orderNumber: input.orderNumber,
                buyerName: input.recipientName,
                buyerEmail: input.recipientEmail,
                paymentMethod: input.paymentMethod,
                amount: input.amount,
                paidAt: input.paidAt,
            });
            break;
        case "ORDER_SHIPPED":
            type = "ORDER_SHIPPED";
            title = "Pesanan Dikirim";
            message = `Pesanan ${input.orderNumber} telah dikirim dengan ${input.shippingProvider}. No. Resi: ${input.trackingNumber}`;
            data = {
                order_id: input.orderId,
                order_number: input.orderNumber,
                tracking_number: input.trackingNumber,
                shipping_provider: input.shippingProvider,
            };
            emailPromise = sendShippingNotificationEmail({
                orderNumber: input.orderNumber,
                buyerName: input.recipientName,
                buyerEmail: input.recipientEmail,
                trackingNumber: input.trackingNumber,
                shippingProvider: input.shippingProvider,
                trackingUrl: input.trackingUrl,
            });
            break;
        case "ORDER_DELIVERED":
            type = "ORDER_DELIVERED";
            title = input.audience === "buyer" ? "Pesanan Sampai" : "Pesanan Terkirim";
            message = input.audience === "buyer"
                ? `Pesanan ${input.orderNumber} telah dikonfirmasi sampai.`
                : `Pembeli telah mengkonfirmasi penerimaan pesanan ${input.orderNumber}.`;
            data = { order_id: input.orderId, order_number: input.orderNumber };
            emailPromise = input.audience === "buyer" && input.recipientEmail && input.recipientName
                ? sendOrderDeliveredEmail(input.recipientEmail, input.recipientName, input.orderId)
                : null;
            break;
        case "ORDER_COMPLETED":
            type = "ORDER_COMPLETED";
            title = input.audience === "buyer" ? "Pesanan Selesai" : "Dana Dirilis";
            message = input.audience === "buyer"
                ? input.autoReleased
                    ? `Pesanan ${input.orderNumber} otomatis diselesaikan setelah masa konfirmasi berakhir.`
                    : `Pesanan ${input.orderNumber} telah Anda selesaikan. Terima kasih.`
                : input.autoReleased
                    ? `Dana pesanan ${input.orderNumber} dirilis otomatis ke saldo Anda.`
                    : `Pembeli menyelesaikan pesanan ${input.orderNumber}. Dana telah dirilis.`;
            data = {
                order_id: input.orderId,
                order_number: input.orderNumber,
                auto_released: input.autoReleased,
            };
            break;
        case "REVIEW_RECEIVED":
            type = "REVIEW_RECEIVED";
            title = "Review Baru";
            message = `${input.actorName} memberikan rating ${input.rating}/5 untuk ${input.productTitle}`;
            data = {
                review_id: input.reviewId,
                product_id: input.productId,
                rating: input.rating,
            };
            break;
        case "REVIEW_REPLY":
            type = "REVIEW_REPLY";
            title = "Balasan Review";
            message = "Penjual telah membalas review Anda";
            data = {
                review_id: input.reviewId,
                product_id: input.productId,
            };
            break;
        case "DISPUTE_OPENED":
            type = "DISPUTE_OPENED";
            title = input.audience === "admin" ? "Dispute Baru" : "Dispute Dibuka";
            message = input.audience === "buyer"
                ? `Dispute untuk pesanan ${input.orderNumber} telah dibuka.`
                : input.audience === "seller"
                    ? `Pembeli membuka dispute untuk pesanan ${input.orderNumber}.`
                    : `Dispute baru pada pesanan ${input.orderNumber} membutuhkan perhatian.`;
            data = {
                dispute_id: input.disputeId,
                order_id: input.orderId,
                order_number: input.orderNumber,
                dispute_type: input.disputeType,
            };
            break;
        case "DISPUTE_UPDATED":
            type = "DISPUTE_UPDATED";
            title = "Dispute Diperbarui";
            message = `Status dispute untuk pesanan ${input.orderNumber} berubah menjadi ${input.status}.`;
            data = {
                dispute_id: input.disputeId,
                order_id: input.orderId,
                order_number: input.orderNumber,
                status: input.status,
            };
            break;
        case "OFFER_RECEIVED":
            type = "OFFER_RECEIVED";
            title = input.round === 1 ? "Penawaran Baru" : `Counter Offer (Ronde ${input.round})`;
            message = `${input.actorName} menawar ${input.amount} untuk ${input.productTitle}.`;
            data = {
                offer_id: input.offerId,
                product_title: input.productTitle,
                amount: input.amount,
                round: input.round,
            };
            break;
        case "OFFER_ACCEPTED":
            type = "OFFER_ACCEPTED";
            title = "Penawaran Diterima";
            message = `Penawaran ${input.amount} untuk ${input.productTitle} disetujui. Selesaikan checkout sebelum waktu habis.`;
            data = {
                offer_id: input.offerId,
                product_title: input.productTitle,
                amount: input.amount,
            };
            break;
    }

    const [notification] = await db
        .insert(notifications)
        .values({
            user_id: input.recipientUserId,
            type,
            title,
            message,
            idempotency_key: idempotencyKey,
            data,
        })
        .returning();

    logger.info("notify:dispatched", {
        event: input.event,
        recipientUserId: input.recipientUserId,
        idempotencyKey,
        notificationId: notification.id,
    });

    if (emailPromise) {
        // TECH-01: route email send through queue so future BullMQ adapter can retry.
        // Current InProcessQueue runs handlers synchronously so semantics match.
        await enqueue("send-email", {
            event: input.event,
            recipientUserId: input.recipientUserId,
            idempotencyKey,
        });
        try {
            await emailPromise;
        } catch (error) {
            logger.error("notify:email_failed", { event: input.event, error: String(error) });
        }
    }

    return { notification, duplicate: false };
}