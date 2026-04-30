"use server";

import { db } from "@/db";
import { disputes, messages, offers, order_items, orders, product_events, products, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, asc, eq, inArray } from "drizzle-orm";

/**
 * DIF-11: Negotiation audit replay.
 *
 * Returns a chronologically ordered timeline of every interaction event tied
 * to a specific (buyer, seller, product) thread — chats, offers, and PDP
 * impression milestones. Used by:
 *   - /order/[id]/timeline (post-purchase audit for buyer/seller)
 *   - /admin/disputes/[id]/timeline (TRUST_OPS evidence view)
 *
 * Visibility:
 *   - Buyer / seller can only fetch threads they're a party to.
 *   - Admin gets unrestricted access.
 */

export type TimelineEventKind =
    | "CHAT"
    | "OFFER_SUBMIT"
    | "OFFER_COUNTER"
    | "OFFER_ACCEPT"
    | "OFFER_REJECT"
    | "OFFER_EXPIRE"
    | "PDP_IMPRESSION"
    | "PDP_OFFER_FOCUS"
    | "ORDER_CREATED"
    | "DISPUTE_OPENED";

export interface TimelineEvent {
    id: string;
    kind: TimelineEventKind;
    occurredAt: Date;
    actor: { id: string; role: "buyer" | "seller" | "system" | "admin" };
    summary: string;
    meta?: Record<string, unknown>;
}

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

interface ResolvedContext {
    productId: string;
    buyerId: string;
    sellerId: string;
    orderId?: string | null;
    disputeId?: string | null;
}

async function resolveContextForOrder(orderId: string): Promise<ResolvedContext | null> {
    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        columns: { id: true, buyer_id: true, seller_id: true },
    });
    if (!order) return null;

    // Fetch first product reference via order_items relation (not all schemas
    // expose the relation key the same way; use raw query as a safe fallback).
    const items = await db.query.order_items.findMany({
        where: eq(order_items.order_id, order.id),
        columns: { product_id: true },
        limit: 1,
    });
    const productId = items[0]?.product_id;
    if (!productId) return null;
    return {
        productId,
        buyerId: order.buyer_id,
        sellerId: order.seller_id,
        orderId: order.id,
    };
}

async function resolveContextForDispute(disputeId: string): Promise<ResolvedContext | null> {
    const dispute = await db.query.disputes.findFirst({
        where: eq(disputes.id, disputeId),
        columns: { id: true, order_id: true, reporter_id: true, reported_id: true },
    });
    if (!dispute) return null;
    if (dispute.order_id) {
        const ctx = await resolveContextForOrder(dispute.order_id);
        if (ctx) return { ...ctx, disputeId: dispute.id };
    }
    // Fallback: best-effort, no product/order — still return the parties.
    return {
        productId: "",
        buyerId: dispute.reporter_id,
        sellerId: dispute.reported_id,
        disputeId: dispute.id,
    };
}

function sanitizeChatBody(content: string | null): string {
    if (!content) return "";
    // Strip phone numbers, emails, URLs as a defense-in-depth measure.
    return content
        .replace(/\b\d{8,}\b/g, "[NOMOR]")
        .replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]")
        .replace(/https?:\/\/\S+/g, "[LINK]")
        .slice(0, 500);
}

export async function getInteractionTimeline(input: {
    orderId?: string;
    disputeId?: string;
}): Promise<{
    events: TimelineEvent[];
    context: ResolvedContext;
}> {
    const user = await getCurrentUser();
    const isAdmin = user.role === "ADMIN";

    const ctx = input.orderId
        ? await resolveContextForOrder(input.orderId)
        : input.disputeId
            ? await resolveContextForDispute(input.disputeId)
            : null;
    if (!ctx) throw new Error("Konteks timeline tidak ditemukan.");

    if (!isAdmin && user.id !== ctx.buyerId && user.id !== ctx.sellerId) {
        throw new Error("Anda bukan pihak dalam thread ini.");
    }

    const events: TimelineEvent[] = [];

    // Offers between buyer and seller for this product.
    if (ctx.productId) {
        const offerRows = await db.query.offers.findMany({
            where: and(
                eq(offers.listing_id, ctx.productId),
                eq(offers.buyer_id, ctx.buyerId),
                eq(offers.seller_id, ctx.sellerId)
            ),
            orderBy: [asc(offers.created_at)],
        });

        for (const o of offerRows) {
            const baseActor = {
                id: o.actor_role === "buyer" ? o.buyer_id : o.seller_id,
                role: (o.is_auto_counter ? "system" : o.actor_role === "buyer" ? "buyer" : "seller") as TimelineEvent["actor"]["role"],
            };
            events.push({
                id: `offer-${o.id}`,
                kind: o.is_auto_counter || o.round > 1 ? "OFFER_COUNTER" : "OFFER_SUBMIT",
                occurredAt: o.created_at,
                actor: baseActor,
                summary: `${baseActor.role === "system" ? "Sistem auto-counter" : baseActor.role === "buyer" ? "Buyer menawar" : "Seller meng-counter"} sebesar Rp ${Number(o.amount).toLocaleString("id-ID")}`,
                meta: {
                    amount: Number(o.amount),
                    status: o.status,
                    round: o.round,
                    intentScore: o.intent_score,
                },
            });
            if (o.decided_at && (o.status === "ACCEPTED" || o.status === "REJECTED")) {
                events.push({
                    id: `offer-decision-${o.id}`,
                    kind: o.status === "ACCEPTED" ? "OFFER_ACCEPT" : "OFFER_REJECT",
                    occurredAt: o.decided_at,
                    actor: { id: o.decided_by ?? o.seller_id, role: "seller" },
                    summary: o.status === "ACCEPTED" ? "Tawaran diterima" : "Tawaran ditolak",
                });
            }
        }

        // PDP impression milestones — sample first impression and first
        // OFFER_INPUT_FOCUS only to keep timeline readable.
        const pdpEvents = await db.query.product_events.findMany({
            where: and(
                eq(product_events.product_id, ctx.productId),
                eq(product_events.user_id, ctx.buyerId),
                inArray(product_events.event_type, ["IMPRESSION", "OFFER_INPUT_FOCUS"])
            ),
            orderBy: [asc(product_events.occurred_at)],
            limit: 10,
        });
        for (const e of pdpEvents) {
            events.push({
                id: `pdp-${e.id}`,
                kind: e.event_type === "OFFER_INPUT_FOCUS" ? "PDP_OFFER_FOCUS" : "PDP_IMPRESSION",
                occurredAt: e.occurred_at,
                actor: { id: ctx.buyerId, role: "buyer" },
                summary: e.event_type === "OFFER_INPUT_FOCUS" ? "Buyer membuka panel tawar" : "Buyer melihat halaman produk",
                meta: { source: e.source },
            });
        }
    }

    // Chat messages between the two parties on this product (if any conversation exists).
    if (ctx.productId) {
        const product = await db.query.products.findFirst({
            where: eq(products.id, ctx.productId),
            columns: { id: true, title: true },
        });
        const chatRows = await db
            .select({
                id: messages.id,
                conv: messages.conversation_id,
                sender_id: messages.sender_id,
                content: messages.content,
                created_at: messages.created_at,
            })
            .from(messages)
            .where(
                and(
                    inArray(messages.sender_id, [ctx.buyerId, ctx.sellerId]),
                    eq(messages.product_reference_id, ctx.productId)
                )
            )
            .orderBy(asc(messages.created_at));

        void product;
        for (const m of chatRows) {
            events.push({
                id: `chat-${m.id}`,
                kind: "CHAT",
                occurredAt: m.created_at,
                actor: {
                    id: m.sender_id,
                    role: m.sender_id === ctx.buyerId ? "buyer" : "seller",
                },
                summary: sanitizeChatBody(m.content),
            });
        }
    }

    // Order created.
    if (ctx.orderId) {
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, ctx.orderId),
            columns: { id: true, created_at: true, order_number: true, total: true },
        });
        if (order) {
            events.push({
                id: `order-${order.id}`,
                kind: "ORDER_CREATED",
                occurredAt: order.created_at,
                actor: { id: ctx.buyerId, role: "buyer" },
                summary: `Order ${order.order_number} dibuat (total Rp ${Number(order.total).toLocaleString("id-ID")})`,
            });
        }
    }

    // Dispute opened.
    if (ctx.disputeId) {
        const dispute = await db.query.disputes.findFirst({
            where: eq(disputes.id, ctx.disputeId),
            columns: { id: true, created_at: true, dispute_number: true, reporter_id: true, title: true },
        });
        if (dispute) {
            events.push({
                id: `dispute-${dispute.id}`,
                kind: "DISPUTE_OPENED",
                occurredAt: dispute.created_at,
                actor: { id: dispute.reporter_id, role: dispute.reporter_id === ctx.buyerId ? "buyer" : "seller" },
                summary: `Sengketa ${dispute.dispute_number} dibuka: ${dispute.title}`,
            });
        }
    }

    events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

    void users;
    return { events, context: ctx };
}
