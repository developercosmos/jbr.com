"use server";

import { db } from "@/db";
import { wishlists, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Get current user
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
// WISHLIST ACTIONS
// ============================================

export async function addToWishlist(productId: string) {
    const user = await getCurrentUser();

    // Check if product exists
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
    });

    if (!product || product.status !== "PUBLISHED") {
        throw new Error("Product not available");
    }

    if (product.seller_id === user.id) {
        throw new Error("Cannot add your own product to wishlist");
    }

    // Check if already in wishlist
    const existing = await db.query.wishlists.findFirst({
        where: and(eq(wishlists.user_id, user.id), eq(wishlists.product_id, productId)),
    });

    if (existing) {
        return { success: true, message: "Already in wishlist" };
    }

    // Add to wishlist
    const [wishlistItem] = await db
        .insert(wishlists)
        .values({
            user_id: user.id,
            product_id: productId,
        })
        .returning();

    revalidatePath("/profile/wishlist");
    return { success: true, wishlistItem };
}

export async function removeFromWishlist(productId: string) {
    const user = await getCurrentUser();

    await db
        .delete(wishlists)
        .where(and(eq(wishlists.user_id, user.id), eq(wishlists.product_id, productId)));

    revalidatePath("/profile/wishlist");
    return { success: true };
}

export async function getWishlist() {
    const user = await getCurrentUser();

    const wishlistItems = await db.query.wishlists.findMany({
        where: eq(wishlists.user_id, user.id),
        orderBy: [desc(wishlists.created_at)],
        with: {
            product: {
                with: {
                    seller: {
                        columns: {
                            id: true,
                            name: true,
                            store_name: true,
                        },
                    },
                    category: true,
                },
            },
        },
    });

    return wishlistItems;
}

export async function isInWishlist(productId: string): Promise<boolean> {
    const user = await getCurrentUser();

    const existing = await db.query.wishlists.findFirst({
        where: and(eq(wishlists.user_id, user.id), eq(wishlists.product_id, productId)),
    });

    return !!existing;
}

export async function getWishlistCount() {
    const user = await getCurrentUser();

    const items = await db.query.wishlists.findMany({
        where: eq(wishlists.user_id, user.id),
        columns: { id: true },
    });

    return items.length;
}
