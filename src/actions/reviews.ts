"use server";

import { db } from "@/db";
import { reviews, order_items, orders, products, users, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, avg, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
// CREATE REVIEW
// ============================================
const createReviewSchema = z.object({
    order_item_id: z.string().uuid(),
    rating: z.number().min(1).max(5),
    comment: z.string().optional(),
    images: z.array(z.string().url()).optional(),
});

export async function createReview(input: z.infer<typeof createReviewSchema>) {
    const user = await getCurrentUser();
    const validated = createReviewSchema.parse(input);

    // Get order item with order and product info
    const orderItem = await db.query.order_items.findFirst({
        where: eq(order_items.id, validated.order_item_id),
        with: {
            order: true,
            product: true,
        },
    });

    if (!orderItem) {
        throw new Error("Order item not found");
    }

    // Verify buyer owns this order
    if (orderItem.order.buyer_id !== user.id) {
        throw new Error("Unauthorized");
    }

    // Check order is completed or delivered
    if (!["DELIVERED", "COMPLETED"].includes(orderItem.order.status)) {
        throw new Error("Can only review after order is delivered");
    }

    // Check if already reviewed
    const existingReview = await db.query.reviews.findFirst({
        where: eq(reviews.order_item_id, validated.order_item_id),
    });

    if (existingReview) {
        throw new Error("Already reviewed this item");
    }

    // Create review
    const [review] = await db
        .insert(reviews)
        .values({
            order_item_id: validated.order_item_id,
            buyer_id: user.id,
            product_id: orderItem.product_id,
            seller_id: orderItem.order.seller_id,
            rating: validated.rating,
            comment: validated.comment,
            images: validated.images || [],
        })
        .returning();

    // Notify seller about new review
    await db.insert(notifications).values({
        user_id: orderItem.order.seller_id,
        type: "NEW_REVIEW",
        title: "Review Baru",
        message: `${user.name} memberikan rating ${validated.rating}/5 untuk ${orderItem.product.title}`,
        data: {
            review_id: review.id,
            product_id: orderItem.product_id,
            rating: validated.rating,
        },
    });

    revalidatePath(`/product/${orderItem.product.slug}`);
    revalidatePath("/profile/orders");
    revalidatePath("/seller/reviews");

    return { success: true, review };
}

// ============================================
// GET PRODUCT REVIEWS
// ============================================
export async function getProductReviews(productId: string) {
    const productReviews = await db.query.reviews.findMany({
        where: eq(reviews.product_id, productId),
        orderBy: [desc(reviews.created_at)],
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        },
    });

    return productReviews;
}

// ============================================
// GET PRODUCT RATING STATS
// ============================================
export async function getProductRatingStats(productId: string) {
    const stats = await db
        .select({
            average: avg(reviews.rating),
            total: count(),
        })
        .from(reviews)
        .where(eq(reviews.product_id, productId));

    // Get rating distribution
    const distribution = await db
        .select({
            rating: reviews.rating,
            count: count(),
        })
        .from(reviews)
        .where(eq(reviews.product_id, productId))
        .groupBy(reviews.rating);

    const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
        ratingCounts[d.rating] = d.count;
    });

    return {
        average: stats[0]?.average ? parseFloat(stats[0].average) : 0,
        total: stats[0]?.total || 0,
        distribution: ratingCounts,
    };
}

// ============================================
// REPLY TO REVIEW (Seller)
// ============================================
export async function replyToReview(reviewId: string, reply: string) {
    const user = await getCurrentUser();

    // Get review
    const review = await db.query.reviews.findFirst({
        where: eq(reviews.id, reviewId),
    });

    if (!review) {
        throw new Error("Review not found");
    }

    // Verify seller owns this review
    if (review.seller_id !== user.id) {
        throw new Error("Unauthorized");
    }

    // Update review with reply
    const [updated] = await db
        .update(reviews)
        .set({
            seller_reply: reply,
            seller_reply_at: new Date(),
        })
        .where(eq(reviews.id, reviewId))
        .returning();

    // Notify buyer about reply
    await db.insert(notifications).values({
        user_id: review.buyer_id,
        type: "REVIEW_REPLY",
        title: "Balasan Review",
        message: "Penjual telah membalas review Anda",
        data: {
            review_id: reviewId,
            product_id: review.product_id,
        },
    });

    revalidatePath("/seller/reviews");

    return { success: true, review: updated };
}

// ============================================
// GET SELLER REVIEWS
// ============================================
export async function getSellerReviews() {
    const user = await getCurrentUser();

    const sellerReviews = await db.query.reviews.findMany({
        where: eq(reviews.seller_id, user.id),
        orderBy: [desc(reviews.created_at)],
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
            product: {
                columns: {
                    id: true,
                    title: true,
                    slug: true,
                    images: true,
                },
            },
        },
    });

    return sellerReviews;
}

// ============================================
// GET SELLER RATING STATS
// ============================================
export async function getSellerRatingStats(sellerId: string) {
    const stats = await db
        .select({
            average: avg(reviews.rating),
            total: count(),
        })
        .from(reviews)
        .where(eq(reviews.seller_id, sellerId));

    return {
        average: stats[0]?.average ? parseFloat(stats[0].average) : 0,
        total: stats[0]?.total || 0,
    };
}

// ============================================
// CHECK IF CAN REVIEW
// ============================================
export async function canReviewOrderItem(orderItemId: string) {
    const user = await getCurrentUser();

    // Get order item
    const orderItem = await db.query.order_items.findFirst({
        where: eq(order_items.id, orderItemId),
        with: {
            order: true,
        },
    });

    if (!orderItem) {
        return { canReview: false, reason: "Order item not found" };
    }

    if (orderItem.order.buyer_id !== user.id) {
        return { canReview: false, reason: "Not your order" };
    }

    if (!["DELIVERED", "COMPLETED"].includes(orderItem.order.status)) {
        return { canReview: false, reason: "Order not delivered yet" };
    }

    // Check if already reviewed
    const existingReview = await db.query.reviews.findFirst({
        where: eq(reviews.order_item_id, orderItemId),
    });

    if (existingReview) {
        return { canReview: false, reason: "Already reviewed" };
    }

    return { canReview: true };
}
