"use server";

import { db } from "@/db";
import { product_event_daily, product_events, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";

const EVENT_TYPES = [
    "IMPRESSION",
    "CLICK",
    "ADD_TO_CART",
    "WISHLIST_ADD",
    "CHECKOUT_START",
    "PURCHASE",
] as const;

const recordSchema = z.object({
    productId: z.string().uuid(),
    eventType: z.enum(EVENT_TYPES),
    sessionId: z.string().max(64).optional(),
    source: z.string().max(40).optional(), // "search" | "home" | "category" | "pdp" | "direct"
    searchTerm: z.string().max(120).optional(),
    referrer: z.string().max(400).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
});

const batchSchema = z.object({
    events: z.array(recordSchema).max(50),
});

async function getCurrentUserOrNull() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        return session?.user ?? null;
    } catch {
        return null;
    }
}

/**
 * ANLY-01: record a single product event. Lightweight insert; the rollup
 * aggregator (runProductEventRollup) folds events into product_event_daily
 * once per day for fast dashboard queries.
 */
export async function recordProductEvent(input: z.infer<typeof recordSchema>) {
    const validated = recordSchema.parse(input);
    const user = await getCurrentUserOrNull();

    try {
        await db.insert(product_events).values({
            product_id: validated.productId,
            user_id: user?.id ?? null,
            session_id: validated.sessionId ?? null,
            event_type: validated.eventType,
            source: validated.source ?? null,
            search_term: validated.searchTerm ?? null,
            referrer: validated.referrer ?? null,
            meta: validated.meta ?? null,
        });
        return { recorded: true };
    } catch (error) {
        logger.warn("product-events:insert_failed", { error: String(error) });
        return { recorded: false };
    }
}

/**
 * Batched variant for client-side IntersectionObserver impressions.
 * Drops events for unknown products silently to keep the path resilient.
 */
export async function recordProductEvents(input: z.infer<typeof batchSchema>) {
    const validated = batchSchema.parse(input);
    const user = await getCurrentUserOrNull();

    try {
        const rows = validated.events.map((event) => ({
            product_id: event.productId,
            user_id: user?.id ?? null,
            session_id: event.sessionId ?? null,
            event_type: event.eventType,
            source: event.source ?? null,
            search_term: event.searchTerm ?? null,
            referrer: event.referrer ?? null,
            meta: event.meta ?? null,
        }));
        if (rows.length > 0) {
            await db.insert(product_events).values(rows);
        }
        return { inserted: rows.length };
    } catch (error) {
        logger.warn("product-events:batch_failed", { error: String(error), count: validated.events.length });
        return { inserted: 0 };
    }
}

export interface ProductEventRollupResult {
    daysProcessed: number;
    rowsUpserted: number;
    eventsRetainedDays: number;
}

/**
 * ANLY-01: rollup raw product_events into daily aggregates and prune old raw rows.
 * Runs nightly via cron entrypoint. Idempotent — re-running same day overwrites
 * existing aggregate row counts.
 */
export async function runProductEventRollup(): Promise<ProductEventRollupResult> {
    const retentionDays = Number(process.env.PRODUCT_EVENTS_RETAIN_DAYS || 90);

    // Aggregate events from yesterday + today (covers crons that drift across midnight).
    const ranges = [
        { offset: -1 },
        { offset: 0 },
    ];
    let rowsUpserted = 0;
    for (const range of ranges) {
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        day.setUTCDate(day.getUTCDate() + range.offset);
        const dayIso = day.toISOString().slice(0, 10);
        const next = new Date(day);
        next.setUTCDate(next.getUTCDate() + 1);

        const aggregates = await db
            .select({
                product_id: product_events.product_id,
                event_type: product_events.event_type,
                count: sql<number>`count(*)`,
            })
            .from(product_events)
            .where(and(sql`${product_events.occurred_at} >= ${day}`, sql`${product_events.occurred_at} < ${next}`))
            .groupBy(product_events.product_id, product_events.event_type);

        for (const row of aggregates) {
            await db
                .insert(product_event_daily)
                .values({
                    product_id: row.product_id,
                    date: dayIso,
                    event_type: row.event_type,
                    count: Number(row.count),
                })
                .onConflictDoUpdate({
                    target: [product_event_daily.product_id, product_event_daily.date, product_event_daily.event_type],
                    set: { count: Number(row.count) },
                });
            rowsUpserted++;
        }
    }

    // Prune raw events older than retention window.
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    await db.delete(product_events).where(lt(product_events.occurred_at, cutoff));

    return { daysProcessed: ranges.length, rowsUpserted, eventsRetainedDays: retentionDays };
}

/**
 * ANLY-02 funnel data per seller. Returns per-event-type sums for the seller's
 * products in [start, end). Day strings expected as 'YYYY-MM-DD'.
 */
export async function getSellerFunnel(sellerId: string, startDate: string, endDate: string) {
    const rows = await db
        .select({
            event_type: product_event_daily.event_type,
            total: sql<number>`coalesce(sum(${product_event_daily.count}), 0)`,
        })
        .from(product_event_daily)
        .innerJoin(products, eq(products.id, product_event_daily.product_id))
        .where(
            and(
                eq(products.seller_id, sellerId),
                sql`${product_event_daily.date} >= ${startDate}`,
                sql`${product_event_daily.date} <= ${endDate}`
            )
        )
        .groupBy(product_event_daily.event_type);

    const stats: Record<string, number> = {
        IMPRESSION: 0,
        CLICK: 0,
        ADD_TO_CART: 0,
        CHECKOUT_START: 0,
        PURCHASE: 0,
        WISHLIST_ADD: 0,
    };
    for (const row of rows) {
        stats[row.event_type] = Number(row.total);
    }
    return stats;
}

/**
 * ANLY-02 per-product breakdown — top sellers by purchase count + funnel %.
 */
export async function getSellerTopProducts(sellerId: string, startDate: string, endDate: string, limit = 10) {
    const rows = await db
        .select({
            product_id: product_event_daily.product_id,
            product_title: products.title,
            product_slug: products.slug,
            event_type: product_event_daily.event_type,
            total: sql<number>`coalesce(sum(${product_event_daily.count}), 0)`,
        })
        .from(product_event_daily)
        .innerJoin(products, eq(products.id, product_event_daily.product_id))
        .where(
            and(
                eq(products.seller_id, sellerId),
                sql`${product_event_daily.date} >= ${startDate}`,
                sql`${product_event_daily.date} <= ${endDate}`
            )
        )
        .groupBy(product_event_daily.product_id, products.title, products.slug, product_event_daily.event_type);

    type Row = {
        productId: string;
        title: string;
        slug: string;
        impressions: number;
        clicks: number;
        addToCart: number;
        purchases: number;
    };
    const map = new Map<string, Row>();
    for (const row of rows) {
        const entry = map.get(row.product_id) ?? {
            productId: row.product_id,
            title: row.product_title,
            slug: row.product_slug,
            impressions: 0,
            clicks: 0,
            addToCart: 0,
            purchases: 0,
        };
        if (row.event_type === "IMPRESSION") entry.impressions = Number(row.total);
        if (row.event_type === "CLICK") entry.clicks = Number(row.total);
        if (row.event_type === "ADD_TO_CART") entry.addToCart = Number(row.total);
        if (row.event_type === "PURCHASE") entry.purchases = Number(row.total);
        map.set(row.product_id, entry);
    }

    return Array.from(map.values())
        .sort((a, b) => b.purchases - a.purchases || b.clicks - a.clicks)
        .slice(0, limit);
}
