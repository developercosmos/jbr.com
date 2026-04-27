"use server";

import { db } from "@/db";
import { carts, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, isNull } from "drizzle-orm";
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

export async function addToCart(productId: string, quantity = 1, variantId?: string) {
    // Check auth without throwing
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return { success: false, error: "unauthorized" };
    }

    const user = session.user;

    // Check if product exists and is available
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
            variants: true,
        },
    });

    if (!product || product.status !== "PUBLISHED") {
        return { success: false, error: "product_not_available" };
    }

    if (product.seller_id === user.id) {
        return { success: false, error: "own_product" };
    }

    const hasVariants = product.variants.length > 0;
    const selectedVariant = variantId
        ? product.variants.find((variant) => variant.id === variantId)
        : null;

    if (hasVariants && !selectedVariant) {
        return { success: false, error: "variant_required" };
    }

    if (selectedVariant && (!selectedVariant.is_available || selectedVariant.stock < quantity)) {
        return { success: false, error: "insufficient_stock" };
    }

    if (!hasVariants && product.stock < quantity) {
        return { success: false, error: "insufficient_stock" };
    }

    // Check if already in cart
    const existingCartItem = await db.query.carts.findFirst({
        where: and(
            eq(carts.user_id, user.id),
            eq(carts.product_id, productId),
            variantId ? eq(carts.variant_id, variantId) : isNull(carts.variant_id)
        ),
    });

    if (existingCartItem) {
        const nextQuantity = existingCartItem.quantity + quantity;

        if (selectedVariant && nextQuantity > selectedVariant.stock) {
            return { success: false, error: "insufficient_stock" };
        }

        if (!selectedVariant && nextQuantity > product.stock) {
            return { success: false, error: "insufficient_stock" };
        }

        // Update quantity
        const [updated] = await db
            .update(carts)
            .set({
                quantity: nextQuantity,
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
            variant_id: selectedVariant?.id,
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

    const existingCartItem = await db.query.carts.findFirst({
        where: and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)),
        with: {
            product: true,
            variant: true,
        },
    });

    if (!existingCartItem) {
        throw new Error("Cart item not found");
    }

    const availableStock = existingCartItem.variant?.stock ?? existingCartItem.product.stock;

    if (quantity > availableStock) {
        throw new Error("Requested quantity exceeds available stock");
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
                    variants: {
                        columns: {
                            id: true,
                        },
                    },
                    seller: {
                        columns: {
                            id: true,
                            name: true,
                            store_name: true,
                        },
                    },
                },
            },
            variant: true,
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
    } catch (error) {
        console.error("getCartCount failed:", error);
        return 0;
    }
}

