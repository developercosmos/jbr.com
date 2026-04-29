"use server";

import { db } from "@/db";
import {
    buyer_interaction_ratings,
    buyer_reputation_access_log,
    buyer_reputation_summary,
    buyer_ratings,
    conversations,
    disputes,
    messages,
    offers,
    orders,
    reviews,
    seller_ratings,
    users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const REVEAL_WINDOW_DAYS = Number(process.env.BUYER_RATING_REVEAL_DAYS || 14);

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

// ============================================
// RATE-01: Seller rating aggregate
// ============================================
export async function recomputeSellerRating(sellerId: string) {
    // Average review rating from product reviews where this user is the seller.
    const [reviewStats] = await db
        .select({
            avg: sql<string>`coalesce(avg(${reviews.rating}), 0)`,
            total: sql<number>`count(*)`,
        })
        .from(reviews)
        .where(eq(reviews.seller_id, sellerId));

    // Completion / cancellation rate from order history.
    const [orderStats] = await db
        .select({
            total: sql<number>`count(*)`,
            completed: sql<number>`sum(case when ${orders.status} = 'COMPLETED' then 1 else 0 end)`,
            cancelled: sql<number>`sum(case when ${orders.status} = 'CANCELLED' then 1 else 0 end)`,
        })
        .from(orders)
        .where(eq(orders.seller_id, sellerId));

    const [disputeStats] = await db
        .select({
            total: sql<number>`count(*)`,
        })
        .from(disputes)
        .where(eq(disputes.reported_id, sellerId));

    // Seller response time: average minutes from buyer message to first seller reply per conversation.
    const responseRows = (await db.execute(sql`
        WITH first_buyer_msg AS (
            SELECT m.conversation_id, MIN(m.created_at) AS at
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.seller_id = ${sellerId}
              AND m.sender_id = c.buyer_id
            GROUP BY m.conversation_id
        ),
        first_seller_reply AS (
            SELECT m.conversation_id, MIN(m.created_at) AS at
            FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE c.seller_id = ${sellerId}
              AND m.sender_id = c.seller_id
            GROUP BY m.conversation_id
        )
        SELECT coalesce(avg(extract(epoch from (s.at - b.at)) / 60.0), 0)::int AS minutes
        FROM first_buyer_msg b
        JOIN first_seller_reply s ON s.conversation_id = b.conversation_id
        WHERE s.at >= b.at;
    `)) as unknown as Array<{ minutes?: number | string }>;
    const responseMinutes = Number(responseRows?.[0]?.minutes ?? 0);

    const totalOrders = Number(orderStats?.total ?? 0);
    const completedOrders = Number(orderStats?.completed ?? 0);
    const cancelledOrders = Number(orderStats?.cancelled ?? 0);
    const completionRate = totalOrders > 0 ? (completedOrders * 100) / totalOrders : 0;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders * 100) / totalOrders : 0;
    const disputeRate = totalOrders > 0 ? (Number(disputeStats?.total ?? 0) * 100) / totalOrders : 0;

    const avgRating = Number(reviewStats?.avg ?? 0);
    const ratingCount = Number(reviewStats?.total ?? 0);

    const ratingScore = Math.max(0, Math.min(100, (avgRating / 5) * 100));
    const responseScore = responseMinutes <= 0 ? 70 : Math.max(0, Math.min(100, ((720 - responseMinutes) / 720) * 100));
    const reliabilityScore =
        0.3 * ratingScore +
        0.2 * responseScore +
        0.2 * completionRate +
        0.15 * (100 - cancellationRate) +
        0.15 * (100 - disputeRate);
    const reliabilityTier =
        reliabilityScore >= 85
            ? "PLATINUM"
            : reliabilityScore >= 70
                ? "GOLD"
                : reliabilityScore >= 55
                    ? "SILVER"
                    : "BRONZE";

    await db
        .insert(seller_ratings)
        .values({
            user_id: sellerId,
            avg_rating: avgRating.toFixed(2),
            rating_count: ratingCount,
            completion_rate: completionRate.toFixed(2),
            cancellation_rate: cancellationRate.toFixed(2),
            dispute_rate: disputeRate.toFixed(2),
            reliability_score: reliabilityScore.toFixed(2),
            reliability_tier: reliabilityTier,
            response_time_minutes_avg: responseMinutes,
            last_recomputed_at: new Date(),
        })
        .onConflictDoUpdate({
            target: seller_ratings.user_id,
            set: {
                avg_rating: avgRating.toFixed(2),
                rating_count: ratingCount,
                completion_rate: completionRate.toFixed(2),
                cancellation_rate: cancellationRate.toFixed(2),
                dispute_rate: disputeRate.toFixed(2),
                reliability_score: reliabilityScore.toFixed(2),
                reliability_tier: reliabilityTier,
                response_time_minutes_avg: responseMinutes,
                last_recomputed_at: new Date(),
            },
        });

    return {
        avg_rating: avgRating,
        rating_count: ratingCount,
        completion_rate: completionRate,
        cancellation_rate: cancellationRate,
        dispute_rate: disputeRate,
        reliability_score: reliabilityScore,
        reliability_tier: reliabilityTier,
        response_time_minutes_avg: responseMinutes,
    };
}

export async function getSellerRating(sellerId: string) {
    return db.query.seller_ratings.findFirst({
        where: eq(seller_ratings.user_id, sellerId),
    });
}

// ============================================
// RATE-02: Buyer rating with reveal window
// ============================================
const submitBuyerRatingSchema = z.object({
    orderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    tags: z.array(z.string().max(40)).max(8).optional(),
    comment: z.string().max(500).optional(),
});

type Direction = "SELLER_RATES_BUYER" | "BUYER_RATES_SELLER";
type InteractionContext = "ORDER" | "OFFER" | "CHAT";

async function recomputeBuyerScore(rateeId: string) {
    const [stats] = await db
        .select({
            avg: sql<string>`coalesce(avg(${buyer_ratings.rating}), 0)`,
            total: sql<number>`count(*)`,
        })
        .from(buyer_ratings)
        .where(and(eq(buyer_ratings.ratee_id, rateeId), eq(buyer_ratings.direction, "SELLER_RATES_BUYER")));

    await db
        .update(users)
        .set({
            buyer_score: Number(stats?.avg ?? 0).toFixed(2),
            buyer_score_count: Number(stats?.total ?? 0),
            updated_at: new Date(),
        })
        .where(eq(users.id, rateeId));
}

export async function submitBuyerRating(input: z.infer<typeof submitBuyerRatingSchema>) {
    const user = await getCurrentUser();
    const validated = submitBuyerRatingSchema.parse(input);

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, validated.orderId),
        columns: {
            id: true,
            status: true,
            buyer_id: true,
            seller_id: true,
            updated_at: true,
        },
    });

    if (!order) {
        throw new Error("Pesanan tidak ditemukan");
    }

    if (order.status !== "COMPLETED") {
        throw new Error("Rating hanya bisa diberikan setelah pesanan selesai.");
    }

    // Determine direction by participant role on this order.
    let direction: Direction;
    let rateeId: string;
    if (user.id === order.seller_id) {
        direction = "SELLER_RATES_BUYER";
        rateeId = order.buyer_id;
    } else if (user.id === order.buyer_id) {
        direction = "BUYER_RATES_SELLER";
        rateeId = order.seller_id;
    } else {
        throw new Error("Anda bukan peserta pesanan ini.");
    }

    // Submission window check: 14 days from order completion (proxied by updated_at).
    const windowEnd = new Date(order.updated_at.getTime() + REVEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (Date.now() > windowEnd.getTime()) {
        throw new Error("Masa pemberian rating untuk pesanan ini sudah berakhir.");
    }

    await db
        .insert(buyer_ratings)
        .values({
            order_id: validated.orderId,
            rater_id: user.id,
            ratee_id: rateeId,
            direction,
            rating: validated.rating,
            tags: validated.tags,
            comment: validated.comment,
        })
        .onConflictDoNothing({
            target: [buyer_ratings.order_id, buyer_ratings.direction],
        });

    if (direction === "SELLER_RATES_BUYER") {
        await recomputeBuyerScore(rateeId);
    } else {
        await recomputeSellerRating(rateeId);
    }

    revalidatePath(`/profile/orders/${validated.orderId}`);
    revalidatePath(`/seller/orders/${validated.orderId}`);

    return { success: true, direction };
}

const submitBuyerInteractionRatingSchema = z.object({
    contextType: z.enum(["ORDER", "OFFER", "CHAT"]),
    contextId: z.string().uuid(),
    buyerId: z.string(),
    rating: z.number().int().min(1).max(5),
    tags: z.array(
        z.enum([
            "EXTREME_LOWBALL",
            "NO_FOLLOW_UP",
            "GHOSTING",
            "RUDE_COMMUNICATION",
            "TIMELY_AND_COMMUNICATIVE",
            "FAIR_NEGOTIATOR",
        ])
    ).max(8).default([]),
    note: z.string().max(500).optional(),
});

const openBuyerRatingDisputeSchema = z.object({
    interactionRatingId: z.string().uuid(),
    reason: z.string().min(8).max(1200),
});

const moderateBuyerInteractionRatingSchema = z.object({
    interactionRatingId: z.string().uuid(),
    invalidated: z.boolean(),
    reason: z.string().max(500).optional(),
});

function clamp(num: number, min: number, max: number) {
    return Math.min(max, Math.max(min, num));
}

function reputationBandFromScore(score: number): "LOW" | "MEDIUM" | "HIGH" {
    if (score < 40) return "LOW";
    if (score < 70) return "MEDIUM";
    return "HIGH";
}

async function assertSellerInteractionContext(
    sellerId: string,
    contextType: InteractionContext,
    contextId: string,
    expectedBuyerId: string
) {
    if (contextType === "ORDER") {
        const order = await db.query.orders.findFirst({
            where: eq(orders.id, contextId),
            columns: { id: true, buyer_id: true, seller_id: true, status: true },
        });
        if (!order || order.seller_id !== sellerId || order.buyer_id !== expectedBuyerId) {
            throw new Error("Interaksi ORDER tidak valid untuk seller ini.");
        }
        if (order.status !== "COMPLETED") {
            throw new Error("Rating buyer dari konteks ORDER hanya tersedia setelah pesanan selesai.");
        }
        return;
    }

    if (contextType === "OFFER") {
        const offer = await db.query.offers.findFirst({
            where: eq(offers.id, contextId),
            columns: { id: true, buyer_id: true, seller_id: true, status: true },
        });
        if (!offer || offer.seller_id !== sellerId || offer.buyer_id !== expectedBuyerId) {
            throw new Error("Interaksi OFFER tidak valid untuk seller ini.");
        }
        if (offer.status === "PENDING") {
            throw new Error("Rating calon buyer hanya bisa diberikan setelah offer tidak lagi pending.");
        }
        return;
    }

    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, contextId),
        columns: { id: true, buyer_id: true, seller_id: true },
    });
    if (!conversation || conversation.seller_id !== sellerId || conversation.buyer_id !== expectedBuyerId) {
        throw new Error("Interaksi CHAT tidak valid untuk seller ini.");
    }
}

async function hasInteractionRecord(sellerId: string, buyerId: string) {
    const [ordersCount, offersCount, conversationsCount] = await Promise.all([
        db
            .select({ total: sql<number>`count(*)` })
            .from(orders)
            .where(and(eq(orders.seller_id, sellerId), eq(orders.buyer_id, buyerId))),
        db
            .select({ total: sql<number>`count(*)` })
            .from(offers)
            .where(and(eq(offers.seller_id, sellerId), eq(offers.buyer_id, buyerId))),
        db
            .select({ total: sql<number>`count(*)` })
            .from(conversations)
            .where(and(eq(conversations.seller_id, sellerId), eq(conversations.buyer_id, buyerId))),
    ]);

    return (
        Number(ordersCount[0]?.total ?? 0) > 0 ||
        Number(offersCount[0]?.total ?? 0) > 0 ||
        Number(conversationsCount[0]?.total ?? 0) > 0
    );
}

async function recomputeBuyerReputationSummaryInternal(buyerId: string) {
    const rows = await db.query.buyer_interaction_ratings.findMany({
        where: and(eq(buyer_interaction_ratings.buyer_id, buyerId), eq(buyer_interaction_ratings.is_invalidated, false)),
        columns: { rating: true, tags: true },
    });

    const sampleSize = rows.length;
    const avgRaw = sampleSize > 0
        ? rows.reduce((sum, row) => sum + Number(row.rating), 0) / sampleSize
        : 0;

    let lowballCount = 0;
    let noFollowUpCount = 0;
    let ghostingCount = 0;
    let fairNegotiatorCount = 0;

    for (const row of rows) {
        const tags = row.tags ?? [];
        if (tags.includes("EXTREME_LOWBALL")) lowballCount++;
        if (tags.includes("NO_FOLLOW_UP")) noFollowUpCount++;
        if (tags.includes("GHOSTING")) ghostingCount++;
        if (tags.includes("FAIR_NEGOTIATOR")) fairNegotiatorCount++;
    }

    const [orderStats] = await db
        .select({
            total: sql<number>`count(*)`,
            completed: sql<number>`sum(case when ${orders.status} = 'COMPLETED' then 1 else 0 end)`,
        })
        .from(orders)
        .where(eq(orders.buyer_id, buyerId));

    const totalOrders = Number(orderStats?.total ?? 0);
    const completedOrders = Number(orderStats?.completed ?? 0);
    const completionRate = totalOrders > 0 ? completedOrders / totalOrders : 0;

    const priorRating = 4;
    const priorWeight = 5;
    const weightedAvg = (priorRating * priorWeight + avgRaw * sampleSize) / (priorWeight + sampleSize || 1);
    let score = weightedAvg * 20;

    if (lowballCount >= 5) score -= 10;
    if (noFollowUpCount >= 5) score -= 8;
    if (sampleSize > 0 && ghostingCount / sampleSize > 0.3) score -= 15;
    if (completionRate > 0.9 && totalOrders >= 5) score += 10;
    if (fairNegotiatorCount >= 10) score += 5;

    score = clamp(score, 0, 100);
    const band = reputationBandFromScore(score);

    await db
        .insert(buyer_reputation_summary)
        .values({
            buyer_id: buyerId,
            score: score.toFixed(2),
            band,
            sample_size: sampleSize,
            avg_rating: avgRaw.toFixed(2),
            completed_orders: completedOrders,
            lowball_count: lowballCount,
            no_follow_up_count: noFollowUpCount,
            ghosting_count: ghostingCount,
            fair_negotiator_count: fairNegotiatorCount,
            computed_at: new Date(),
            updated_at: new Date(),
        })
        .onConflictDoUpdate({
            target: buyer_reputation_summary.buyer_id,
            set: {
                score: score.toFixed(2),
                band,
                sample_size: sampleSize,
                avg_rating: avgRaw.toFixed(2),
                completed_orders: completedOrders,
                lowball_count: lowballCount,
                no_follow_up_count: noFollowUpCount,
                ghosting_count: ghostingCount,
                fair_negotiator_count: fairNegotiatorCount,
                computed_at: new Date(),
                updated_at: new Date(),
            },
        });

    await db
        .update(users)
        .set({
            buyer_score: (score / 20).toFixed(2),
            buyer_score_count: sampleSize,
            updated_at: new Date(),
        })
        .where(eq(users.id, buyerId));

    return {
        buyerId,
        score,
        band,
        sampleSize,
        avgRating: avgRaw,
        completedOrders,
        lowballCount,
        noFollowUpCount,
        ghostingCount,
        fairNegotiatorCount,
    };
}

export async function submitBuyerInteractionRating(input: z.infer<typeof submitBuyerInteractionRatingSchema>) {
    const user = await getCurrentUser();
    const validated = submitBuyerInteractionRatingSchema.parse(input);

    await assertSellerInteractionContext(
        user.id,
        validated.contextType,
        validated.contextId,
        validated.buyerId
    );

    const now = new Date();
    const existing = await db.query.buyer_interaction_ratings.findFirst({
        where: and(
            eq(buyer_interaction_ratings.seller_id, user.id),
            eq(buyer_interaction_ratings.buyer_id, validated.buyerId),
            eq(buyer_interaction_ratings.context_type, validated.contextType),
            eq(buyer_interaction_ratings.context_id, validated.contextId)
        ),
    });

    let ratingId = existing?.id;
    if (existing) {
        if (now.getTime() > existing.edited_until.getTime()) {
            throw new Error("Periode edit rating sudah berakhir (24 jam).");
        }

        await db
            .update(buyer_interaction_ratings)
            .set({
                rating: validated.rating,
                tags: validated.tags,
                note: validated.note,
                updated_at: now,
            })
            .where(eq(buyer_interaction_ratings.id, existing.id));
    } else {
        const [created] = await db
            .insert(buyer_interaction_ratings)
            .values({
                seller_id: user.id,
                buyer_id: validated.buyerId,
                context_type: validated.contextType,
                context_id: validated.contextId,
                rating: validated.rating,
                tags: validated.tags,
                note: validated.note,
                edited_until: new Date(now.getTime() + 24 * 60 * 60 * 1000),
                created_at: now,
                updated_at: now,
            })
            .returning({ id: buyer_interaction_ratings.id });

        ratingId = created.id;
    }

    const summary = await recomputeBuyerReputationSummaryInternal(validated.buyerId);

    revalidatePath("/messages");
    revalidatePath("/profile/orders");

    return { success: true, ratingId, summary };
}

export async function getSellerInteractionRatingForContext(contextType: InteractionContext, contextId: string, buyerId: string) {
    const user = await getCurrentUser();

    return db.query.buyer_interaction_ratings.findFirst({
        where: and(
            eq(buyer_interaction_ratings.seller_id, user.id),
            eq(buyer_interaction_ratings.context_type, contextType),
            eq(buyer_interaction_ratings.context_id, contextId),
            eq(buyer_interaction_ratings.buyer_id, buyerId)
        ),
    });
}

export async function openBuyerRatingDispute(input: z.infer<typeof openBuyerRatingDisputeSchema>) {
    const user = await getCurrentUser();
    const validated = openBuyerRatingDisputeSchema.parse(input);

    const target = await db.query.buyer_interaction_ratings.findFirst({
        where: eq(buyer_interaction_ratings.id, validated.interactionRatingId),
    });

    if (!target) {
        throw new Error("Rating interaksi tidak ditemukan.");
    }

    if (user.id !== target.buyer_id && user.id !== target.seller_id) {
        throw new Error("Anda tidak memiliki akses untuk sengketa rating ini.");
    }

    const reportedId = user.id === target.buyer_id ? target.seller_id : target.buyer_id;
    const disputeNumber = `DSP-RATE-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

    const [created] = await db
        .insert(disputes)
        .values({
            reporter_id: user.id,
            reported_id: reportedId,
            dispute_number: disputeNumber,
            type: "OTHER",
            dispute_subject: "BUYER_RATING",
            target_rating_id: target.id,
            priority: "NORMAL",
            status: "OPEN",
            title: "Sengketa Penilaian Buyer/Calon Buyer",
            description: validated.reason,
        })
        .returning({ id: disputes.id, dispute_number: disputes.dispute_number });

    await db
        .update(buyer_interaction_ratings)
        .set({ is_disputed: true, updated_at: new Date() })
        .where(eq(buyer_interaction_ratings.id, target.id));

    revalidatePath("/admin/disputes");

    return { success: true, disputeId: created.id, disputeNumber: created.dispute_number };
}

export async function moderateBuyerInteractionRating(input: z.infer<typeof moderateBuyerInteractionRatingSchema>) {
    const user = await getCurrentUser();
    if (user.role !== "ADMIN") {
        throw new Error("Admin access required.");
    }

    const validated = moderateBuyerInteractionRatingSchema.parse(input);
    const rating = await db.query.buyer_interaction_ratings.findFirst({
        where: eq(buyer_interaction_ratings.id, validated.interactionRatingId),
    });

    if (!rating) {
        throw new Error("Interaction rating tidak ditemukan.");
    }

    await db
        .update(buyer_interaction_ratings)
        .set({
            is_invalidated: validated.invalidated,
            note: validated.reason ? `${rating.note ?? ""}\n[ADMIN MODERATION] ${validated.reason}`.trim() : rating.note,
            updated_at: new Date(),
        })
        .where(eq(buyer_interaction_ratings.id, rating.id));

    await recomputeBuyerReputationSummaryInternal(rating.buyer_id);

    revalidatePath("/admin/disputes");
    revalidatePath("/seller/orders");

    return { success: true, buyerId: rating.buyer_id, invalidated: validated.invalidated };
}

export async function recomputeBuyerReputationSummary(buyerId: string) {
    await getCurrentUser();
    return recomputeBuyerReputationSummaryInternal(buyerId);
}

interface RatingPair {
    sellerToBuyer: typeof buyer_ratings.$inferSelect | null;
    buyerToSeller: typeof buyer_ratings.$inferSelect | null;
    revealed: boolean;
    submissionWindowOpen: boolean;
}

/**
 * Reveal logic: a rating is visible to the *opposite* party only when both
 * directions have been submitted, OR the reveal window has closed. Until then,
 * each side sees only their own submission. This prevents retaliation: I can't
 * read your rating before I write mine.
 */
export async function getOrderRatingPair(orderId: string): Promise<RatingPair> {
    const user = await getCurrentUser();

    const order = await db.query.orders.findFirst({
        where: eq(orders.id, orderId),
        columns: {
            id: true,
            status: true,
            buyer_id: true,
            seller_id: true,
            updated_at: true,
        },
    });

    if (!order) {
        throw new Error("Pesanan tidak ditemukan");
    }

    if (user.id !== order.buyer_id && user.id !== order.seller_id) {
        throw new Error("Anda bukan peserta pesanan ini.");
    }

    const rows = await db.query.buyer_ratings.findMany({
        where: eq(buyer_ratings.order_id, orderId),
    });

    const buyerToSeller = rows.find((r) => r.direction === "BUYER_RATES_SELLER") ?? null;
    const sellerToBuyer = rows.find((r) => r.direction === "SELLER_RATES_BUYER") ?? null;
    const bothSubmitted = !!buyerToSeller && !!sellerToBuyer;
    const windowEnd = new Date(order.updated_at.getTime() + REVEAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const windowClosed = Date.now() > windowEnd.getTime();
    const revealed = bothSubmitted || windowClosed;

    function maskOpposite(direction: Direction): typeof buyer_ratings.$inferSelect | null {
        const row = direction === "BUYER_RATES_SELLER" ? buyerToSeller : sellerToBuyer;
        if (!row) return null;
        // Caller is the *rater* if their id matches; otherwise the ratee.
        const callerIsRater = row.rater_id === user.id;
        if (callerIsRater) return row;
        return revealed ? row : null;
    }

    return {
        buyerToSeller: maskOpposite("BUYER_RATES_SELLER"),
        sellerToBuyer: maskOpposite("SELLER_RATES_BUYER"),
        revealed,
        submissionWindowOpen: !windowClosed,
    };
}

// ============================================
// RATE-03: Reputation gates
// ============================================
const COD_MIN_BUYER_SCORE = Number(process.env.COD_MIN_BUYER_SCORE || 4);
const COD_MIN_COMPLETED_ORDERS = Number(process.env.COD_MIN_COMPLETED_ORDERS || 3);

export async function isBuyerEligibleForCod(buyerId: string): Promise<{
    eligible: boolean;
    reason?: string;
    buyerScore: number;
    buyerScoreCount: number;
    completedOrders: number;
}> {
    const buyer = await db.query.users.findFirst({
        where: eq(users.id, buyerId),
        columns: {
            id: true,
            buyer_score: true,
            buyer_score_count: true,
        },
    });

    if (!buyer) {
        return { eligible: false, reason: "Buyer tidak ditemukan", buyerScore: 0, buyerScoreCount: 0, completedOrders: 0 };
    }

    const [completedRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(and(eq(orders.buyer_id, buyerId), eq(orders.status, "COMPLETED")));

    const completed = Number(completedRow?.count ?? 0);
    const score = Number(buyer.buyer_score);
    const count = buyer.buyer_score_count;

    if (completed < COD_MIN_COMPLETED_ORDERS) {
        return {
            eligible: false,
            reason: `Minimal ${COD_MIN_COMPLETED_ORDERS} pesanan selesai dibutuhkan untuk COD.`,
            buyerScore: score,
            buyerScoreCount: count,
            completedOrders: completed,
        };
    }
    if (count > 0 && score < COD_MIN_BUYER_SCORE) {
        return {
            eligible: false,
            reason: `Skor buyer Anda (${score.toFixed(2)}) di bawah batas COD (${COD_MIN_BUYER_SCORE}).`,
            buyerScore: score,
            buyerScoreCount: count,
            completedOrders: completed,
        };
    }
    return { eligible: true, buyerScore: score, buyerScoreCount: count, completedOrders: completed };
}

// ============================================
// RATE-04: Surface helpers used by PDP / store / chat / admin
// ============================================
export interface ReputationSummary {
    sellerId: string;
    avgRating: number;
    ratingCount: number;
    completionRate: number;
    cancellationRate: number;
    disputeRate: number;
    responseTimeMinutes: number;
    reliabilityScore: number;
    reliabilityTier: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
}

export async function getSellerReputationSummary(sellerId: string): Promise<ReputationSummary> {
    const row = await db.query.seller_ratings.findFirst({
        where: eq(seller_ratings.user_id, sellerId),
    });

    if (!row) {
        return {
            sellerId,
            avgRating: 0,
            ratingCount: 0,
            completionRate: 0,
            cancellationRate: 0,
            disputeRate: 0,
            responseTimeMinutes: 0,
            reliabilityScore: 0,
            reliabilityTier: "BRONZE",
        };
    }

    return {
        sellerId,
        avgRating: Number(row.avg_rating),
        ratingCount: row.rating_count,
        completionRate: Number(row.completion_rate),
        cancellationRate: Number(row.cancellation_rate),
        disputeRate: Number(row.dispute_rate),
        responseTimeMinutes: row.response_time_minutes_avg,
        reliabilityScore: Number(row.reliability_score),
        reliabilityTier: (row.reliability_tier as "BRONZE" | "SILVER" | "GOLD" | "PLATINUM") ?? "BRONZE",
    };
}

export async function getBuyerReputationSummary(buyerId: string) {
    const user = await getCurrentUser();

    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const [recentAccess] = await db
        .select({ total: sql<number>`count(*)` })
        .from(buyer_reputation_access_log)
        .where(
            and(
                eq(buyer_reputation_access_log.viewer_id, user.id),
                sql`${buyer_reputation_access_log.created_at} >= ${oneMinuteAgo}`
            )
        );
    if (Number(recentAccess?.total ?? 0) >= 60) {
        throw new Error("Rate limit akses reputasi terlampaui. Coba lagi sebentar.");
    }

    let summary = await db.query.buyer_reputation_summary.findFirst({
        where: eq(buyer_reputation_summary.buyer_id, buyerId),
    });

    if (!summary) {
        await recomputeBuyerReputationSummaryInternal(buyerId);
        summary = await db.query.buyer_reputation_summary.findFirst({
            where: eq(buyer_reputation_summary.buyer_id, buyerId),
        });
    }

    if (!summary) {
        return {
            buyerId,
            visibility: "none" as const,
            band: "MEDIUM" as const,
            score: null,
            sampleSize: 0,
        };
    }

    const isSelf = user.id === buyerId;
    const isAdmin = user.role === "ADMIN";

    if (!isSelf && !isAdmin) {
        const allowed = await hasInteractionRecord(user.id, buyerId);
        if (!allowed) {
            throw new Error("Akses reputasi buyer ditolak: belum ada interaksi.");
        }
    }

    const visibility = isSelf || isAdmin ? "full" : "band";

    if (!isSelf) {
        await db.insert(buyer_reputation_access_log).values({
            buyer_id: buyerId,
            viewer_id: user.id,
            visibility,
            reason: isAdmin ? "admin_review" : "interaction_required",
        });
    }

    return {
        buyerId,
        visibility,
        band: summary.band,
        score: visibility === "full" ? Number(summary.score) : null,
        sampleSize: summary.sample_size,
        avgRating: visibility === "full" ? Number(summary.avg_rating) : null,
        completedOrders: visibility === "full" ? summary.completed_orders : null,
    };
}

// Sweep-style helper: refresh ratings for sellers with stale aggregates.
// Suitable for a cron job. Updates one seller per call site; callers may loop.
export async function recomputeAllSellerRatingsForActiveSellers(): Promise<{ updated: number }> {
    const sellerIdsRows = await db
        .selectDistinct({ id: orders.seller_id })
        .from(orders);

    let updated = 0;
    for (const row of sellerIdsRows) {
        if (!row.id) continue;
        await recomputeSellerRating(row.id);
        updated++;
    }
    return { updated };
}

// Suppress unused-import warnings for symbols reserved for follow-up surfaces.
void isNull;
void ne;
void or;
