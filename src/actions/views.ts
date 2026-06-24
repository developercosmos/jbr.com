"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { assertInternalCall } from "@/lib/internal-guard";

/**
 * Increment view count for a product (legacy counter; live analytics use
 * product_events). Internal-only so the counter can't be inflated by anonymous POSTs.
 */
export async function incrementProductViews(productId: string, internalToken?: string) {
    assertInternalCall(internalToken);
    try {
        await db
            .update(products)
            .set({
                views: sql`COALESCE(${products.views}, 0) + 1`,
            })
            .where(eq(products.id, productId));

        return { success: true };
    } catch (error) {
        console.error("Error incrementing views:", error);
        return { success: false };
    }
}

/**
 * Get product view count
 */
export async function getProductViews(productId: string): Promise<number> {
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: {
            views: true,
        },
    });

    return product?.views || 0;
}
