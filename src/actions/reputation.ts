"use server";

import { db } from "@/db";
import {
    buyer_ratings,
    conversations,
    messages,
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

    const avgRating = Number(reviewStats?.avg ?? 0);
    const ratingCount = Number(reviewStats?.total ?? 0);

    await db
        .insert(seller_ratings)
        .values({
            user_id: sellerId,
            avg_rating: avgRating.toFixed(2),
            rating_count: ratingCount,
            completion_rate: completionRate.toFixed(2),
            cancellation_rate: cancellationRate.toFixed(2),
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
                response_time_minutes_avg: responseMinutes,
                last_recomputed_at: new Date(),
            },
        });

    return {
        avg_rating: avgRating,
        rating_count: ratingCount,
        completion_rate: completionRate,
        cancellation_rate: cancellationRate,
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
    responseTimeMinutes: number;
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
            responseTimeMinutes: 0,
        };
    }

    return {
        sellerId,
        avgRating: Number(row.avg_rating),
        ratingCount: row.rating_count,
        completionRate: Number(row.completion_rate),
        cancellationRate: Number(row.cancellation_rate),
        responseTimeMinutes: row.response_time_minutes_avg,
    };
}

export async function getBuyerReputationSummary(buyerId: string) {
    const buyer = await db.query.users.findFirst({
        where: eq(users.id, buyerId),
        columns: {
            id: true,
            buyer_score: true,
            buyer_score_count: true,
        },
    });

    if (!buyer) {
        return { buyerId, score: 0, count: 0 };
    }

    return {
        buyerId,
        score: Number(buyer.buyer_score),
        count: buyer.buyer_score_count,
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
