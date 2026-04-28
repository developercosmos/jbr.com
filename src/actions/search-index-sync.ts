"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { reconcileSearchIndex } from "@/lib/search-backend";

/**
 * SRCH-03: nightly reconcile entrypoint. Pulls all PUBLISHED products from
 * Postgres and bulk-indexes into Meilisearch, healing any drift caused by
 * missed real-time syncs.
 */
export async function runSearchIndexReconcile() {
    return reconcileSearchIndex(async () => {
        const rows = await db.query.products.findMany({
            where: eq(products.status, "PUBLISHED"),
            columns: {
                id: true,
                slug: true,
                title: true,
                description: true,
                brand: true,
                price: true,
                weight_class: true,
                balance: true,
                shaft_flex: true,
                grip_size: true,
            },
        });
        return rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            description: r.description,
            brand: r.brand,
            price: r.price,
            weightClass: r.weight_class,
            balance: r.balance,
            shaftFlex: r.shaft_flex,
            gripSize: r.grip_size,
        }));
    });
}
