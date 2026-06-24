"use server";

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { carts, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
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

        // Update quantity. Adding to cart resets save-for-later state and
        // refreshes the abandonment timer (ALERT-02 input).
        const [updated] = await db
            .update(carts)
            .set({
                quantity: nextQuantity,
                saved_for_later: false,
                abandonment_state: null,
                last_mutated_at: new Date(),
            })
            .where(eq(carts.id, existingCartItem.id))
            .returning();

        revalidatePath("/cart");
        return { success: true as const, cartItem: updated };
    }

    // Add new item
    const [cartItem] = await db
        .insert(carts)
        .values({
            user_id: user.id,
            product_id: productId,
            variant_id: selectedVariant?.id,
            quantity,
            last_mutated_at: new Date(),
        })
        .returning();

    // ANLY-01: log ADD_TO_CART event for funnel analytics. Best-effort.
    try {
        const { recordProductEvent } = await import("@/actions/product-events");
        await recordProductEvent({ productId, eventType: "ADD_TO_CART", source: "pdp" });
    } catch {
        // ignore — analytics is non-critical
    }

    revalidatePath("/cart");
    return { success: true as const, cartItem };
}

// REC-03: move item between active cart and "saved for later" bucket.
export async function moveCartItemToSaved(cartItemId: string) {
    try {
        return await moveCartItemToSavedInternal(cartItemId);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal memindahkan item.");
        logger.warn("cart:move_to_saved_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function moveCartItemToSavedInternal(cartItemId: string) {
    const user = await getCurrentUser();
    await db
        .update(carts)
        .set({ saved_for_later: true, last_mutated_at: new Date() })
        .where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)));
    revalidatePath("/cart");
    return { success: true as const };
}

export async function moveSavedItemToCart(cartItemId: string) {
    try {
        return await moveSavedItemToCartInternal(cartItemId);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal memindahkan item.");
        logger.warn("cart:move_to_cart_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function moveSavedItemToCartInternal(cartItemId: string) {
    const user = await getCurrentUser();
    const item = await db.query.carts.findFirst({
        where: and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)),
        with: { product: { columns: { stock: true } }, variant: { columns: { stock: true } } },
    });
    if (!item) throw new Error("Cart item not found");
    const variantStock = Array.isArray(item.variant)
        ? item.variant[0]?.stock
        : item.variant?.stock;
    const productStock = Array.isArray(item.product)
        ? item.product[0]?.stock
        : item.product?.stock;
    const stockAvailable = variantStock ?? productStock ?? 0;
    if (stockAvailable < item.quantity) {
        throw new Error("Stok tidak mencukupi untuk memindahkan item ini ke keranjang.");
    }
    await db
        .update(carts)
        .set({ saved_for_later: false, abandonment_state: null, last_mutated_at: new Date() })
        .where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)));
    revalidatePath("/cart");
    return { success: true as const };
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

    // SECURITY: an offer line locks the negotiated price to ONE unit. Changing its
    // quantity would let the buyer get N units at the 1-unit negotiated price.
    if (existingCartItem.offer_id) {
        throw new Error("Item dengan harga penawaran tidak dapat diubah jumlahnya.");
    }

    const variantStock = Array.isArray(existingCartItem.variant)
        ? existingCartItem.variant[0]?.stock
        : existingCartItem.variant?.stock;
    const productStock = Array.isArray(existingCartItem.product)
        ? existingCartItem.product[0]?.stock
        : existingCartItem.product?.stock;
    const availableStock = variantStock ?? productStock ?? 0;

    if (quantity > availableStock) {
        throw new Error("Requested quantity exceeds available stock");
    }

    const [updated] = await db
        .update(carts)
        .set({ quantity, last_mutated_at: new Date(), abandonment_state: null })
        .where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)))
        .returning();

    if (!updated) {
        throw new Error("Cart item not found");
    }

    revalidatePath("/cart");
    return { success: true as const, cartItem: updated };
}

export async function removeFromCart(cartItemId: string) {
    const user = await getCurrentUser();

    await db.delete(carts).where(and(eq(carts.id, cartItemId), eq(carts.user_id, user.id)));

    revalidatePath("/cart");
    return { success: true as const };
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
            // Locked-offer context: negotiated price + 24h checkout window.
            offer: {
                columns: {
                    id: true,
                    amount: true,
                    status: true,
                    checkout_token: true,
                    checkout_token_expires_at: true,
                    checkout_token_used_at: true,
                },
            },
        },
    });

    // Auto-expire offer lines whose 24h window has passed (or whose offer is no
    // longer accepted) — they drop out of the cart, as promised to the seller.
    const now = Date.now();
    const expiredIds = cartItems
        .filter((i) => {
            if (!i.offer_id) return false;
            if (!i.offer || i.offer.status !== "ACCEPTED") return true;
            if (i.offer.checkout_token_used_at) return true; // already ordered
            const exp = i.offer.checkout_token_expires_at;
            return !exp || new Date(exp).getTime() <= now;
        })
        .map((i) => i.id);

    if (expiredIds.length > 0) {
        await db.delete(carts).where(inArray(carts.id, expiredIds));
        revalidatePath("/cart");
    }

    return cartItems.filter((i) => !expiredIds.includes(i.id));
}

export async function clearCart() {
    const user = await getCurrentUser();

    await db.delete(carts).where(eq(carts.user_id, user.id));

    revalidatePath("/cart");
    return { success: true as const };
}

export async function getCartCount(): Promise<number> {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return 0;
        }

        // Active cart only — exclude saved-for-later from header badge.
        const cartItems = await db.query.carts.findMany({
            where: and(eq(carts.user_id, session.user.id), eq(carts.saved_for_later, false)),
            columns: { quantity: true },
        });

        return cartItems.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    } catch (error) {
        console.error("getCartCount failed:", error);
        return 0;
    }
}

/**
 * Cron: drop accepted-offer cart lines whose 24h window passed (or whose offer
 * is no longer ACCEPTED — e.g. already checked out). Keeps the item from
 * lingering for buyers who never reopen their cart.
 */
export async function runExpiredOfferCartSweep(): Promise<{ removed: number }> {
    const res = await db.execute(sql`
        DELETE FROM carts
        WHERE offer_id IS NOT NULL
          AND offer_id IN (
            SELECT id FROM offers
            WHERE status <> 'ACCEPTED'
               OR checkout_token_used_at IS NOT NULL
               OR checkout_token_expires_at IS NULL
               OR checkout_token_expires_at <= now()
          )
    `);
    return { removed: (res as { rowCount?: number }).rowCount ?? 0 };
}

