import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, categories, users } from "@/db/schema";
import { and, eq, ilike, or, sql, desc } from "drizzle-orm";

// Simple fuzzy matching - breaks query into words and matches any
function buildFuzzyCondition(query: string) {
    const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length > 1);

    if (words.length === 0) return null;

    // Match any word in title or brand
    const conditions = words.map(word =>
        or(
            ilike(products.title, `%${word}%`),
            ilike(products.brand, `%${word}%`)
        )
    );

    return or(...conditions);
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const condition = searchParams.get("condition"); // NEW, PRELOVED, or all
    const limit = Math.min(parseInt(searchParams.get("limit") || "8"), 20);

    try {
        // If no query, return empty results
        if (!query.trim() || query.trim().length < 2) {
            return NextResponse.json({ products: [], categories: [], sellers: [] });
        }

        const fuzzyCondition = buildFuzzyCondition(query);
        if (!fuzzyCondition) {
            return NextResponse.json({ products: [], categories: [], sellers: [] });
        }

        // Build conditions
        const conditions = [
            eq(products.status, "PUBLISHED"),
            fuzzyCondition,
        ];

        if (condition && condition !== "all") {
            conditions.push(eq(products.condition, condition as "NEW" | "PRELOVED"));
        }

        // Search products
        const productResults = await db
            .select({
                id: products.id,
                title: products.title,
                slug: products.slug,
                price: products.price,
                images: products.images,
                condition: products.condition,
                brand: products.brand,
            })
            .from(products)
            .where(and(...conditions))
            .orderBy(desc(products.created_at))
            .limit(limit);

        // Search categories
        const categoryResults = await db
            .select({
                id: categories.id,
                name: categories.name,
                slug: categories.slug,
                icon: categories.icon,
            })
            .from(categories)
            .where(ilike(categories.name, `%${query}%`))
            .limit(4);

        // Search sellers/stores
        const sellerResults = await db
            .select({
                id: users.id,
                name: users.name,
                store_name: users.store_name,
                store_slug: users.store_slug,
                image: users.image,
            })
            .from(users)
            .where(
                and(
                    or(
                        ilike(users.name, `%${query}%`),
                        ilike(users.store_name, `%${query}%`)
                    ),
                    sql`${users.store_slug} IS NOT NULL`
                )
            )
            .limit(3);

        return NextResponse.json({
            products: productResults,
            categories: categoryResults,
            sellers: sellerResults,
        });
    } catch (error) {
        console.error("[Search API] Error:", error);
        return NextResponse.json(
            { error: "Search failed", products: [], categories: [], sellers: [] },
            { status: 500 }
        );
    }
}
