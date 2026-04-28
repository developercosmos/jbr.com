"use server";

import { db } from "@/db";
import { products, user_recently_viewed } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";

const MAX_PER_USER = 100;
const TRIM_AFTER = 120;

async function getCurrentUserOrNull() {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        return session?.user ?? null;
    } catch {
        return null;
    }
}

export async function recordRecentlyViewed(productId: string) {
    const user = await getCurrentUserOrNull();
    if (!user) return { recorded: false };

    await db
        .insert(user_recently_viewed)
        .values({ user_id: user.id, product_id: productId, viewed_at: new Date() })
        .onConflictDoUpdate({
            target: [user_recently_viewed.user_id, user_recently_viewed.product_id],
            set: { viewed_at: new Date() },
        });

    // Opportunistic trim: when count crosses TRIM_AFTER, prune oldest down to MAX_PER_USER.
    // Cheap query path because both columns are indexed.
    const [{ value: total }] = await db
        .select({ value: sql<number>`count(*)` })
        .from(user_recently_viewed)
        .where(eq(user_recently_viewed.user_id, user.id));

    if (Number(total) > TRIM_AFTER) {
        const cutoff = await db
            .select({ viewed_at: user_recently_viewed.viewed_at })
            .from(user_recently_viewed)
            .where(eq(user_recently_viewed.user_id, user.id))
            .orderBy(desc(user_recently_viewed.viewed_at))
            .limit(1)
            .offset(MAX_PER_USER);
        if (cutoff[0]) {
            await db
                .delete(user_recently_viewed)
                .where(
                    and(
                        eq(user_recently_viewed.user_id, user.id),
                        lt(user_recently_viewed.viewed_at, cutoff[0].viewed_at)
                    )
                );
        }
    }

    return { recorded: true };
}

export async function syncRecentlyViewedFromClient(productIds: string[]) {
    const user = await getCurrentUserOrNull();
    if (!user || productIds.length === 0) return { synced: 0 };

    const sliced = productIds.slice(0, 12);
    // Validate productIds exist + published before inserting.
    const valid = await db
        .select({ id: products.id })
        .from(products)
        .where(and(inArray(products.id, sliced), eq(products.status, "PUBLISHED")));
    const validIds = new Set(valid.map((row) => row.id));
    const filtered = sliced.filter((id) => validIds.has(id));

    if (filtered.length === 0) return { synced: 0 };

    const now = new Date();
    for (const id of filtered) {
        await db
            .insert(user_recently_viewed)
            .values({ user_id: user.id, product_id: id, viewed_at: now })
            .onConflictDoUpdate({
                target: [user_recently_viewed.user_id, user_recently_viewed.product_id],
                set: { viewed_at: now },
            });
    }
    return { synced: filtered.length };
}

export async function getRecentlyViewedForUser(limit = 12) {
    const user = await getCurrentUserOrNull();
    if (!user) return [];

    const rows = await db
        .select({
            id: products.id,
            slug: products.slug,
            title: products.title,
            price: products.price,
            images: products.images,
            viewed_at: user_recently_viewed.viewed_at,
        })
        .from(user_recently_viewed)
        .innerJoin(products, eq(products.id, user_recently_viewed.product_id))
        .where(and(eq(user_recently_viewed.user_id, user.id), eq(products.status, "PUBLISHED")))
        .orderBy(desc(user_recently_viewed.viewed_at))
        .limit(limit);

    return rows;
}
