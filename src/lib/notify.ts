"use server";

import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import {
    sendNewOrderNotificationToSeller,
    sendOrderConfirmationEmail,
    sendOrderDeliveredEmail,
    sendPaymentSuccessEmail,
    sendShippingNotificationEmail,
    sendReEngagementEmail,
    sendNotificationEmail,
} from "@/lib/email";
import { enqueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { categoryForEvent, resolveNotificationPreferences } from "@/lib/notification-preferences";
import { eq } from "drizzle-orm";

// Promo/marketing-style events: emailed only to users who opted in
// (email_promo_opt_in). Transactional events are emailed unconditionally above.
const PROMO_EVENTS = new Set([
    "WISHLIST_PRICE_DROP",
    "CART_ABANDONMENT_REMINDER",
    "SELLER_WEEKLY_DIGEST",
]);

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
        event: "ORDER_REFUNDED";
        audience: "buyer";
        recipientUserId: string;
        orderId: string;
        orderNumber: string;
        idempotencyKey?: string;
    }
    | {
        event: "ORDER_CANCELLED";
        audience: "buyer" | "seller";
        recipientUserId: string;
        orderId: string;
        orderNumber: string;
        // Short reason shown in the message (e.g. "tidak dibayar dalam 24 jam").
        reason?: string;
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
        refunded?: boolean;
        resolutionNote?: string | null;
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
        // Who receives this — drives the email deep-link (seller inbox vs buyer offers).
        audience: "buyer" | "seller";
        idempotencyKey?: string;
    }
    | {
        event: "OFFER_ACCEPTED";
        // buyer: item moved to their cart (24h); seller: confirmation.
        audience: "buyer" | "seller";
        recipientUserId: string;
        offerId: string;
        productTitle: string;
        amount: string;
        idempotencyKey?: string;
    }
    | {
        event: "OFFER_SLA_REMINDER";
        recipientUserId: string;
        offerId: string;
        productTitle: string;
        amount: string;
        stage: "T24_SELLER_PENDING" | "T48_BUYER_WAITING" | "T72_EXPIRED";
        suggestions?: Array<{ id: string; slug: string; title: string }>;
        idempotencyKey?: string;
    }
    | {
        event: "WISHLIST_PRICE_DROP";
        recipientUserId: string;
        productId: string;
        productTitle: string;
        productSlug: string;
        baselinePrice: string;
        newPrice: string;
        dropPercent: number;
        // "drop" = price fell >= threshold; "restock" = a wishlisted item came back in
        // stock (0 -> positive). Drives distinct copy so a restock isn't mislabeled as a
        // "Harga turun 100%".
        kind?: "drop" | "restock";
        idempotencyKey?: string;
    }
    | {
        event: "CART_ABANDONMENT_REMINDER";
        recipientUserId: string;
        cartId: string;
        stage: "STAGE_1" | "STAGE_2" | "STAGE_3";
        itemTitles: string[];
        voucherCode?: string;
        idempotencyKey?: string;
    }
    | {
        event: "SELLER_WEEKLY_DIGEST";
        recipientUserId: string;
        recipientEmail: string;
        recipientName: string | null;
        periodStart: string;
        periodEnd: string;
        impressions: number;
        clicks: number;
        purchases: number;
        conversionPct: number;
        topProducts: Array<{ title: string; slug: string; purchases: number }>;
        idempotencyKey?: string;
    }
    | {
        event: "NEW_MESSAGE";
        recipientUserId: string;
        conversationId: string;
        senderName: string;
        preview: string;
        messageId: string;
        idempotencyKey?: string;
    }
    | {
        event: "CHAT_REMINDER";
        recipientUserId: string;
        conversationId: string;
        senderName: string;
        preview: string;
        messageId: string;
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
        case "ORDER_REFUNDED":
            return `${input.event}:${input.orderId}`;
        case "ORDER_CANCELLED":
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
        case "OFFER_SLA_REMINDER":
            return `${input.event}:${input.offerId}:${input.stage}:${input.recipientUserId}`;
        case "WISHLIST_PRICE_DROP": {
            // Throttle to once per (user, product, ISO week)
            const now = new Date();
            const week = `${now.getFullYear()}-W${Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)}`;
            return `${input.event}:${input.productId}:${input.recipientUserId}:${week}`;
        }
        case "CART_ABANDONMENT_REMINDER":
            return `${input.event}:${input.cartId}:${input.stage}`;
        case "SELLER_WEEKLY_DIGEST":
            return `${input.event}:${input.recipientUserId}:${input.periodEnd}`;
        case "NEW_MESSAGE":
            return `${input.event}:${input.messageId}:${input.recipientUserId}`;
        case "CHAT_REMINDER":
            return `${input.event}:${input.conversationId}:${input.recipientUserId}:${input.messageId}`;
    }
}

// Best-effort deep-link for the generic notification email's CTA button.
// Returns a RELATIVE click-through path (+ email label) for an event, audience-aware.
// Persisted to notification.data.url at creation so the in-app bell and the email CTA
// share one source of truth. The email caller prepends the absolute base URL.
function ctaForEvent(input: NotifyInput): { path: string; label: string } | undefined {
    switch (input.event) {
        case "ORDER_CREATED":
        case "ORDER_DELIVERED":
        case "ORDER_COMPLETED":
        case "ORDER_CANCELLED": {
            const audience = "audience" in input ? input.audience : "buyer";
            const path = audience === "seller" ? `/seller/orders/${input.orderId}` : `/profile/orders/${input.orderId}`;
            return { path, label: "Lihat Pesanan" };
        }
        case "PAYMENT_SUCCESS":
        case "ORDER_SHIPPED":
        case "ORDER_REFUNDED":
            return { path: `/profile/orders/${input.orderId}`, label: "Lihat Pesanan" };
        case "DISPUTE_OPENED":
        case "DISPUTE_UPDATED": {
            const path = input.audience === "admin"
                ? `/admin/disputes?id=${input.disputeId}`
                : input.audience === "seller"
                    ? `/seller/orders/${input.orderId}`
                    : `/profile/orders/${input.orderId}`;
            return { path, label: "Lihat Sengketa" };
        }
        case "OFFER_RECEIVED": {
            // Route to the recipient's own offer surface and deep-link the offer.
            const path = input.audience === "seller" ? "/seller/offers" : "/profile/offers";
            return { path: `${path}?offer=${input.offerId}`, label: "Lihat Penawaran" };
        }
        case "OFFER_ACCEPTED":
            // Buyer: item is now in their cart → send them there. Seller: their offers inbox.
            return input.audience === "seller"
                ? { path: `/seller/offers?offer=${input.offerId}`, label: "Lihat Penawaran" }
                : { path: "/cart", label: "Lihat Keranjang" };
        case "OFFER_SLA_REMINDER":
            return { path: `/profile/offers?offer=${input.offerId}`, label: "Lihat Penawaran" };
        case "REVIEW_RECEIVED":
            return { path: "/seller/reviews", label: "Lihat Ulasan" };
        case "REVIEW_REPLY":
            return { path: "/profile", label: "Lihat Ulasan" };
        case "NEW_MESSAGE":
        case "CHAT_REMINDER":
            return { path: "/messages", label: "Buka Chat" };
        case "WISHLIST_PRICE_DROP":
            return { path: `/product/${input.productSlug}`, label: "Lihat Produk" };
        case "CART_ABANDONMENT_REMINDER":
            return { path: "/cart", label: "Lihat Keranjang" };
        case "SELLER_WEEKLY_DIGEST":
            return { path: "/seller/analytics", label: "Lihat Analitik" };
    }
    return undefined;
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
    // Lazy: only invoked when the recipient has email enabled for this category,
    // so disabling a category never fires its email side-effect.
    let emailThunk: (() => Promise<boolean>) | null = null;

    switch (input.event) {
        case "ORDER_CREATED":
            type = "ORDER_CREATED";
            title = input.audience === "buyer" ? "Pesanan Dibuat" : "Pesanan Baru";
            message = input.audience === "buyer"
                ? `Pesanan ${input.orderNumber} berhasil dibuat dan menunggu pembayaran.`
                : `Ada pesanan baru ${input.orderNumber} yang perlu diproses.`;
            data = { order_id: input.orderId, order_number: input.orderNumber, audience: input.audience };
            emailThunk = input.audience === "buyer"
                ? () => sendOrderConfirmationEmail({
                    orderNumber: input.orderNumber,
                    buyerName: input.recipientName,
                    buyerEmail: input.recipientEmail,
                    items: input.items,
                    subtotal: input.subtotal,
                    shippingCost: input.shippingCost,
                    total: input.total,
                })
                : () => sendNewOrderNotificationToSeller(
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
            emailThunk = () => sendPaymentSuccessEmail({
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
            emailThunk = () => sendShippingNotificationEmail({
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
            data = { order_id: input.orderId, order_number: input.orderNumber, audience: input.audience };
            emailThunk = input.audience === "buyer" && input.recipientEmail && input.recipientName
                ? () => sendOrderDeliveredEmail(input.recipientEmail!, input.recipientName!, input.orderId)
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
                audience: input.audience,
            };
            break;
        case "ORDER_REFUNDED":
            type = "ORDER_REFUNDED";
            title = "Dana Dikembalikan";
            message = `Pesanan ${input.orderNumber} telah di-refund. Dana akan dikembalikan ke metode pembayaran Anda.`;
            data = { order_id: input.orderId, order_number: input.orderNumber, audience: input.audience };
            break;
        case "ORDER_CANCELLED":
            // Reuse the ORDER_REFUNDED notification type (no enum migration needed).
            type = "ORDER_REFUNDED";
            title = "Pesanan Dibatalkan";
            message = input.audience === "seller"
                ? `Pesanan ${input.orderNumber} dibatalkan${input.reason ? ` (${input.reason})` : ""}. Stok produk telah dikembalikan otomatis.`
                : `Pesanan ${input.orderNumber} dibatalkan${input.reason ? ` karena ${input.reason}` : ""}. Silakan pesan ulang bila masih dibutuhkan.`;
            // audience drives the in-app deep-link (seller vs buyer order page).
            data = { order_id: input.orderId, order_number: input.orderNumber, audience: input.audience };
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
        case "DISPUTE_UPDATED": {
            type = "DISPUTE_UPDATED";
            const forBuyer = input.audience === "buyer";
            if (input.status === "RESOLVED" || input.status === "CLOSED") {
                const verb = input.status === "RESOLVED" ? "diselesaikan" : "ditutup";
                title = input.status === "RESOLVED" ? "Sengketa Diselesaikan" : "Sengketa Ditutup";
                if (input.refunded) {
                    message = forBuyer
                        ? `Sengketa pesanan ${input.orderNumber} ${verb} admin: dana dikembalikan ke Anda.`
                        : `Sengketa pesanan ${input.orderNumber} ${verb} admin: dana pesanan dikembalikan ke pembeli.`;
                } else {
                    message = `Sengketa pesanan ${input.orderNumber} telah ${verb} oleh admin.`;
                }
            } else {
                title = "Dispute Diperbarui";
                message = `Status sengketa pesanan ${input.orderNumber} berubah menjadi ${input.status}.`;
            }
            if (input.resolutionNote) {
                message += ` Catatan admin: ${input.resolutionNote}`;
            }
            data = {
                dispute_id: input.disputeId,
                order_id: input.orderId,
                order_number: input.orderNumber,
                status: input.status,
            };
            break;
        }
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
            title = input.audience === "seller" ? "Penawaran Diterima — masuk keranjang pembeli" : "Penawaran Diterima";
            message = input.audience === "seller"
                ? `Penawaran ${input.amount} untuk ${input.productTitle} Anda terima. Barang otomatis masuk keranjang pembeli dan akan kedaluwarsa otomatis dalam 24 jam bila tidak di-checkout.`
                : `Penawaran ${input.amount} untuk ${input.productTitle} disetujui. Barang sudah masuk keranjang Anda — selesaikan checkout dalam 24 jam sebelum kedaluwarsa.`;
            data = {
                offer_id: input.offerId,
                product_title: input.productTitle,
                amount: input.amount,
            };
            break;
        case "OFFER_SLA_REMINDER":
            type = "SYSTEM";
            title =
                input.stage === "T24_SELLER_PENDING"
                    ? "Reminder: Tawarkan Respons"
                    : input.stage === "T48_BUYER_WAITING"
                        ? "Seller Belum Merespons"
                        : "Tawaran Kedaluwarsa (SLA)";
            message =
                input.stage === "T24_SELLER_PENDING"
                    ? `Tawaran ${input.amount} untuk ${input.productTitle} sudah menunggu 24 jam.`
                    : input.stage === "T48_BUYER_WAITING"
                        ? `Tawaran Anda untuk ${input.productTitle} belum direspons seller selama 48 jam.`
                        : `Tawaran ${input.amount} untuk ${input.productTitle} berakhir otomatis setelah 72 jam tanpa respons.`;
            data = {
                offer_id: input.offerId,
                product_title: input.productTitle,
                amount: input.amount,
                stage: input.stage,
                suggestions: input.suggestions ?? [],
            };
            break;
        case "WISHLIST_PRICE_DROP": {
            type = "WISHLIST_PRICE_DROP";
            const fmtIDR = (v: string) =>
                new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 })
                    .format(parseFloat(v) || 0);
            if (input.kind === "restock") {
                title = "Kembali tersedia";
                message = `${input.productTitle} di wishlist Anda tersedia lagi (${fmtIDR(input.newPrice)}).`;
            } else {
                title = `Harga turun ${input.dropPercent}%`;
                message = `${input.productTitle} sekarang ${fmtIDR(input.newPrice)} (sebelumnya ${fmtIDR(input.baselinePrice)}).`;
            }
            data = {
                product_id: input.productId,
                product_slug: input.productSlug,
                baseline_price: input.baselinePrice,
                new_price: input.newPrice,
                drop_percent: input.dropPercent,
                kind: input.kind ?? "drop",
            };
            break;
        }
        case "CART_ABANDONMENT_REMINDER":
            type = "CART_ABANDONMENT_REMINDER";
            title =
                input.stage === "STAGE_1"
                    ? "Keranjang Anda menunggu"
                    : input.stage === "STAGE_2"
                        ? "Diskon 5% untuk keranjang Anda"
                        : "Penawaran terakhir: 8% off";
            message = `${input.itemTitles.slice(0, 2).join(", ")}${input.itemTitles.length > 2 ? ` dan ${input.itemTitles.length - 2} lainnya` : ""} masih menunggu checkout.`;
            data = {
                cart_id: input.cartId,
                stage: input.stage,
                voucher_code: input.voucherCode,
                item_count: input.itemTitles.length,
            };
            break;
        case "SELLER_WEEKLY_DIGEST":
            type = "SELLER_WEEKLY_DIGEST";
            title = "Ringkasan toko 7 hari terakhir";
            message = `${input.impressions.toLocaleString("id-ID")} impression · ${input.clicks.toLocaleString("id-ID")} klik · ${input.purchases.toLocaleString("id-ID")} pesanan · ${input.conversionPct.toFixed(2)}% konversi.`;
            data = {
                period_start: input.periodStart,
                period_end: input.periodEnd,
                impressions: input.impressions,
                clicks: input.clicks,
                purchases: input.purchases,
                conversion_pct: input.conversionPct,
                top_products: input.topProducts,
            };
            break;
        case "NEW_MESSAGE":
            type = "NEW_MESSAGE";
            title = `Pesan baru dari ${input.senderName}`;
            message = input.preview;
            data = { conversation_id: input.conversationId, message_id: input.messageId };
            break;
        case "CHAT_REMINDER":
            type = "NEW_MESSAGE";
            title = `Pesan belum dibalas dari ${input.senderName}`;
            message = `"${input.preview}" — pesan ini sudah menunggu lebih dari 1 jam. Balas sekarang agar transaksi tidak terlewat.`;
            data = { conversation_id: input.conversationId, message_id: input.messageId, reminder: true };
            break;
    }

    // Resolve the recipient's per-category preferences. The notification row is
    // ALWAYS written (idempotency + audit ledger); the in-app toggle only hides
    // it from the bell via in_app_suppressed, and the email toggle gates the send.
    const category = categoryForEvent(input.event);
    const recipient = await db.query.users.findFirst({
        where: eq(users.id, input.recipientUserId),
        columns: { email: true, name: true, notification_preferences: true, email_promo_opt_in: true },
    });
    const prefs = resolveNotificationPreferences(
        recipient?.notification_preferences,
        recipient?.email_promo_opt_in,
    );
    const inAppEnabled = prefs[category].inApp;
    const emailEnabled = prefs[category].email;

    // Persist the audience-aware click-through path (computed once here) so the in-app
    // bell routes EVERY notification correctly — the same source of truth as the email
    // CTA below. Events with no cta leave data.url unset (bell uses its legacy fallback).
    const cta = ctaForEvent(input);
    const [notification] = await db
        .insert(notifications)
        .values({
            user_id: input.recipientUserId,
            type,
            title,
            message,
            idempotency_key: idempotencyKey,
            data: cta ? { ...data, url: cta.path } : data,
            in_app_suppressed: !inAppEnabled,
        })
        .returning();

    logger.info("notify:dispatched", {
        event: input.event,
        recipientUserId: input.recipientUserId,
        idempotencyKey,
        notificationId: notification.id,
        category,
        inApp: inAppEnabled,
        email: emailEnabled,
    });

    // Per-message chat pings are in-app only; the email for chat comes from the
    // unanswered-1h CHAT_REMINDER instead (so users aren't emailed per message).
    const emailEligible = input.event !== "NEW_MESSAGE";
    const toEmail =
        "recipientEmail" in input && input.recipientEmail
            ? input.recipientEmail
            : recipient?.email ?? null;
    const toName =
        "recipientName" in input && input.recipientName
            ? input.recipientName
            : recipient?.name ?? null;

    if (emailEnabled && emailEligible && toEmail) {
        // Bespoke template if the event has one; otherwise a generic notification
        // email (re-engagement styling for promo events) built from title/message.
        let thunk = emailThunk;
        if (!thunk) {
            const base = process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com";
            const ctaUrl = cta ? `${base}${cta.path}` : undefined;
            thunk = PROMO_EVENTS.has(input.event)
                ? () => sendReEngagementEmail({ to: toEmail, name: toName, title, message, ctaUrl, ctaLabel: cta?.label })
                : () => sendNotificationEmail({ to: toEmail, name: toName, title, message, ctaUrl, ctaLabel: cta?.label });
        }
        // Route through the queue so a future BullMQ adapter can retry. The
        // in-process adapter runs synchronously so semantics are unchanged.
        await enqueue("send-email", {
            event: input.event,
            recipientUserId: input.recipientUserId,
            idempotencyKey,
        });
        try {
            await thunk();
        } catch (error) {
            logger.error("notify:email_failed", { event: input.event, error: String(error) });
        }
    }

    return { notification, duplicate: false };
}