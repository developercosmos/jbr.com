"use server";

import { db } from "@/db";
import { products, users, wishlist_price_baselines, wishlists } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { logger } from "@/lib/logger";

const PRICE_DROP_PCT = Number(process.env.WISHLIST_PRICE_DROP_PCT || 10);

export interface WishlistAlertSweepResult {
    inspected: number;
    dispatched: number;
}

/**
 * ALERT-01: scan all wishlist entries, compare current product state against
 * captured baseline. Dispatch WISHLIST_PRICE_DROP notification when price has
 * dropped by ≥ PRICE_DROP_PCT or stock went 0→positive. Idempotent per
 * (user, product, ISO week).
 *
 * Captures baseline lazily on first sweep encounter, so existing wishlists
 * pre-feature get baselined on the first run without a separate backfill.
 */
export async function runWishlistPriceDropSweep(): Promise<WishlistAlertSweepResult> {
    const rows = await db
        .select({
            user_id: wishlists.user_id,
            product_id: wishlists.product_id,
            current_price: products.price,
            current_stock: products.stock,
            product_title: products.title,
            product_slug: products.slug,
            user_email: users.email,
            user_name: users.name,
            baseline_price: wishlist_price_baselines.baseline_price,
            baseline_stock: wishlist_price_baselines.baseline_stock,
        })
        .from(wishlists)
        .innerJoin(products, eq(products.id, wishlists.product_id))
        .innerJoin(users, eq(users.id, wishlists.user_id))
        .leftJoin(
            wishlist_price_baselines,
            and(
                eq(wishlist_price_baselines.user_id, wishlists.user_id),
                eq(wishlist_price_baselines.product_id, wishlists.product_id)
            )
        )
        .where(eq(products.status, "PUBLISHED"));

    let dispatched = 0;
    for (const row of rows) {
        const currentPrice = Number(row.current_price);
        const currentStock = row.current_stock;

        if (row.baseline_price === null) {
            // First encounter: capture baseline, no alert.
            await db
                .insert(wishlist_price_baselines)
                .values({
                    user_id: row.user_id,
                    product_id: row.product_id,
                    baseline_price: row.current_price,
                    baseline_stock: currentStock,
                })
                .onConflictDoNothing();
            continue;
        }

        const baselinePrice = Number(row.baseline_price);
        const baselineStock = row.baseline_stock;
        const dropPct = baselinePrice > 0 ? Math.round(((baselinePrice - currentPrice) / baselinePrice) * 100) : 0;
        const dropQualifies = dropPct >= PRICE_DROP_PCT;
        const restockQualifies = baselineStock === 0 && currentStock > 0;

        if (!dropQualifies && !restockQualifies) {
            continue;
        }

        try {
            const result = await notify({
                event: "WISHLIST_PRICE_DROP",
                recipientUserId: row.user_id,
                productId: row.product_id,
                productTitle: row.product_title,
                productSlug: row.product_slug,
                baselinePrice: row.baseline_price,
                newPrice: row.current_price,
                dropPercent: dropQualifies ? dropPct : 100,
            });
            if (!result.duplicate) {
                dispatched++;
                // Reset baseline so future drops measured from new price.
                await db
                    .update(wishlist_price_baselines)
                    .set({
                        baseline_price: row.current_price,
                        baseline_stock: currentStock,
                        last_alerted_at: new Date(),
                    })
                    .where(
                        and(
                            eq(wishlist_price_baselines.user_id, row.user_id),
                            eq(wishlist_price_baselines.product_id, row.product_id)
                        )
                    );
            }
        } catch (error) {
            logger.error("wishlist:alert_dispatch_failed", {
                userId: row.user_id,
                productId: row.product_id,
                error: String(error),
            });
        }
    }

    return { inspected: rows.length, dispatched };
}

void sql;
