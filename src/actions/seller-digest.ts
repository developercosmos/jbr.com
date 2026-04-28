"use server";

import { db } from "@/db";
import { seller_digest_log, users } from "@/db/schema";
import { and, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { getSellerFunnel, getSellerTopProducts } from "@/actions/product-events";
import { logger } from "@/lib/logger";

export interface SellerDigestSweepResult {
    eligibleSellers: number;
    digestsSent: number;
}

function isoDay(offset = 0): string {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
}

/**
 * ANLY-04: nightly sweep — for sellers whose last digest is >= 7 days old,
 * compose a 7-day analytics summary and dispatch via notify.
 */
export async function runSellerWeeklyDigestSweep(): Promise<SellerDigestSweepResult> {
    const now = new Date();
    const oneWeekAgo = new Date(now);
    oneWeekAgo.setUTCDate(oneWeekAgo.getUTCDate() - 7);

    const eligible = await db
        .select({
            id: users.id,
            email: users.email,
            name: users.name,
            store_name: users.store_name,
        })
        .from(users)
        .leftJoin(seller_digest_log, eq(seller_digest_log.seller_id, users.id))
        .where(
            and(
                isNotNull(users.store_slug),
                eq(users.store_status, "ACTIVE"),
                or(
                    sql`${seller_digest_log.last_sent_at} IS NULL`,
                    lt(seller_digest_log.last_sent_at, oneWeekAgo)
                )
            )
        );

    const periodEnd = isoDay(0);
    const periodStart = isoDay(-7);

    let sent = 0;
    for (const seller of eligible) {
        try {
            const funnel = await getSellerFunnel(seller.id, periodStart, periodEnd);
            const topProducts = await getSellerTopProducts(seller.id, periodStart, periodEnd, 5);

            // Skip silent weeks (no impressions) so sellers don't get noisy digests.
            if ((funnel.IMPRESSION || 0) === 0) {
                await db
                    .insert(seller_digest_log)
                    .values({
                        seller_id: seller.id,
                        last_sent_at: now,
                        last_period_start: periodStart,
                        last_period_end: periodEnd,
                    })
                    .onConflictDoUpdate({
                        target: seller_digest_log.seller_id,
                        set: { last_sent_at: now, last_period_start: periodStart, last_period_end: periodEnd },
                    });
                continue;
            }

            const conversion = funnel.IMPRESSION > 0 ? Math.round((funnel.PURCHASE / funnel.IMPRESSION) * 10000) / 100 : 0;

            await notify({
                event: "SELLER_WEEKLY_DIGEST",
                recipientUserId: seller.id,
                recipientEmail: seller.email,
                recipientName: seller.store_name || seller.name,
                periodStart,
                periodEnd,
                impressions: funnel.IMPRESSION,
                clicks: funnel.CLICK,
                purchases: funnel.PURCHASE,
                conversionPct: conversion,
                topProducts: topProducts.map((p) => ({ title: p.title, slug: p.slug, purchases: p.purchases })),
            });

            await db
                .insert(seller_digest_log)
                .values({
                    seller_id: seller.id,
                    last_sent_at: now,
                    last_period_start: periodStart,
                    last_period_end: periodEnd,
                })
                .onConflictDoUpdate({
                    target: seller_digest_log.seller_id,
                    set: { last_sent_at: now, last_period_start: periodStart, last_period_end: periodEnd },
                });
            sent++;
        } catch (error) {
            logger.error("digest:dispatch_failed", { sellerId: seller.id, error: String(error) });
        }
    }

    return { eligibleSellers: eligible.length, digestsSent: sent };
}
