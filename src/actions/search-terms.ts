"use server";

import { db } from "@/db";
import { product_events, products, seller_search_terms_daily } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";

export interface SearchTermRollupResult {
    daysProcessed: number;
    rowsUpserted: number;
}

/**
 * ANLY-03: aggregate raw product_events with non-null search_term into per-seller
 * daily search-term rollups. Run nightly. Idempotent.
 */
export async function runSearchTermRollup(): Promise<SearchTermRollupResult> {
    const ranges = [{ offset: -1 }, { offset: 0 }];
    let rowsUpserted = 0;

    for (const range of ranges) {
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        day.setUTCDate(day.getUTCDate() + range.offset);
        const dayIso = day.toISOString().slice(0, 10);
        const next = new Date(day);
        next.setUTCDate(next.getUTCDate() + 1);
        const dayIsoFull = day.toISOString();
        const nextIsoFull = next.toISOString();

        const aggregates = await db
            .select({
                seller_id: products.seller_id,
                term: product_events.search_term,
                event_type: product_events.event_type,
                count: sql<number>`count(*)`,
            })
            .from(product_events)
            .innerJoin(products, eq(products.id, product_events.product_id))
            .where(
                and(
                    sql`${product_events.search_term} IS NOT NULL`,
                    sql`${product_events.occurred_at} >= ${dayIsoFull}::timestamp`,
                    sql`${product_events.occurred_at} < ${nextIsoFull}::timestamp`
                )
            )
            .groupBy(products.seller_id, product_events.search_term, product_events.event_type);

        for (const row of aggregates) {
            const term = (row.term ?? "").toLowerCase().slice(0, 120).trim();
            if (!term) continue;
            const isClick = row.event_type === "CLICK";
            const click = isClick ? Number(row.count) : 0;
            const impression = !isClick && row.event_type === "IMPRESSION" ? Number(row.count) : 0;

            try {
                await db
                    .insert(seller_search_terms_daily)
                    .values({
                        seller_id: row.seller_id,
                        date: dayIso,
                        term,
                        click_count: click,
                        impression_count: impression,
                    })
                    .onConflictDoUpdate({
                        target: [
                            seller_search_terms_daily.seller_id,
                            seller_search_terms_daily.date,
                            seller_search_terms_daily.term,
                        ],
                        set: {
                            click_count: sql`${seller_search_terms_daily.click_count} + ${click}`,
                            impression_count: sql`${seller_search_terms_daily.impression_count} + ${impression}`,
                        },
                    });
                rowsUpserted++;
            } catch (error) {
                logger.warn("search-terms:upsert_failed", { error: String(error), term });
            }
        }
    }

    return { daysProcessed: ranges.length, rowsUpserted };
}

export async function getSellerSearchTerms(sellerId: string, startDate: string, endDate: string, limit = 50) {
    return db
        .select({
            term: seller_search_terms_daily.term,
            clicks: sql<number>`coalesce(sum(${seller_search_terms_daily.click_count}), 0)`,
            impressions: sql<number>`coalesce(sum(${seller_search_terms_daily.impression_count}), 0)`,
        })
        .from(seller_search_terms_daily)
        .where(
            and(
                eq(seller_search_terms_daily.seller_id, sellerId),
                sql`${seller_search_terms_daily.date} >= ${startDate}`,
                sql`${seller_search_terms_daily.date} <= ${endDate}`
            )
        )
        .groupBy(seller_search_terms_daily.term)
        .orderBy(desc(sql<number>`sum(${seller_search_terms_daily.click_count})`))
        .limit(limit);
}
