"use server";

import { db } from "@/db";
import { carts, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
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
// CART ACTIONS
// ============================================

export async function addToCart(productId: string, quantity = 1) {
    const user = await getCurrentUser();

    // Check if product exists and is available
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
    });

    if (!product || product.status !== "PUBLISHED") {
        throw new Error("Product not available");
    }

    if (product.seller_id === user.id) {
        throw new Error("Cannot add your own product to cart");
    }

    // Check if already in cart
    const existingCartItem = await db.query.carts.findFirst({
        where: and(eq(carts.user_id, user.id), eq(carts.product_id, productId)),
    });

    if (existingCartItem) {
        // Update quantity
        const [updated] = await db
            .update(carts)
            .set({
                quantity: existingCartItem.quantity + quantity,
            })
            .where(eq(carts.id, existingCartItem.id))
            .returning();

        revalidatePath("/cart");
        return { success: true, cartItem: updated };
    }

    // Add new item
    const [cartItem] = await db
        .insert(carts)
        .values({
            user_id: user.id,
            product_id: productId,
            quantity,
        })
        .returning();

    revalidatePath("/cart");
    return { success: true, cartItem };
}

export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
    const user = await getCurrentUser();

    if (quantity <= 0) {
        return removeFromCart(cartItemId);
    }

    const [updated] = await db
        .update(carts)
        .set({ quantity })
        .where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)))
        .returning();

    if (!updated) {
        throw new Error("Cart item not found");
    }

    revalidatePath("/cart");
    return { success: true, cartItem: updated };
}

export async function removeFromCart(cartItemId: string) {
    const user = await getCurrentUser();

    await db.delete(carts).where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)));

    revalidatePath("/cart");
    return { success: true };
}

export async function getCart() {
    const user = await getCurrentUser();

    const cartItems = await db.query.carts.findMany({
        where: eq(carts.user_id, user.id),
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
                },
            },
        },
    });

    return cartItems;
}

export async function clearCart() {
    const user = await getCurrentUser();

    await db.delete(carts).where(eq(carts.user_id, user.id));

    revalidatePath("/cart");
    return { success: true };
}

export async function getCartCount(): Promise<number> {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return 0;
        }

        const cartItems = await db.query.carts.findMany({
            where: eq(carts.user_id, session.user.id),
            columns: { quantity: true },
        });

        return cartItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    } catch {
        return 0;
    }
}

