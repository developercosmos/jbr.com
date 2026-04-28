"use server";

import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { eq, ilike, or, and, sql, desc, asc, inArray, gte } from "drizzle-orm";
import { getSearchBackend } from "@/lib/search-backend";
import { logger } from "@/lib/logger";

function isMeilisearchActive() {
    return process.env.SEARCH_BACKEND === "meilisearch" && !!process.env.MEILISEARCH_HOST;
}

function getSearchVariants(query: string): string[] {
    const base = query.trim().toLowerCase();
    if (!base) return [];

    const normalizedNoSeparators = base.replace(/[\s\-_]+/g, "");
    const normalizedSpace = base.replace(/[\-_]+/g, " ").replace(/\s+/g, " ").trim();

    const variants = new Set<string>([base, normalizedNoSeparators, normalizedSpace]);

    for (const word of normalizedSpace.split(" ")) {
        if (word.length > 1) {
            variants.add(word);
        }
    }

    return Array.from(variants).filter((v) => v.length > 1);
}

// ============================================
// SEARCH PRODUCTS
// ============================================
interface SearchFilters {
    query: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    condition?: "NEW" | "PRELOVED";
    gender?: "UNISEX" | "MEN" | "WOMEN";
    sortBy?: "relevance" | "price_asc" | "price_desc" | "newest" | "popular";
    page?: number;
    limit?: number;
    // NICHE-02: spec filters.
    weightClass?: string[];
    balance?: string[];
    shaftFlex?: string[];
    gripSize?: string[];
    minTensionLbs?: number;
}

async function searchProductsViaMeilisearch(filters: SearchFilters) {
    const limit = filters.limit ?? 24;
    const offset = ((filters.page ?? 1) - 1) * limit;

    const meiliFilters: Record<string, string | string[]> = {};
    if (filters.condition) meiliFilters.condition = filters.condition;
    if (filters.gender) meiliFilters.gender = filters.gender;
    if (filters.weightClass && filters.weightClass.length > 0) meiliFilters.weightClass = filters.weightClass;
    if (filters.balance && filters.balance.length > 0) meiliFilters.balance = filters.balance;
    if (filters.shaftFlex && filters.shaftFlex.length > 0) meiliFilters.shaftFlex = filters.shaftFlex;
    if (filters.gripSize && filters.gripSize.length > 0) meiliFilters.gripSize = filters.gripSize;

    const backend = getSearchBackend();
    const start = Date.now();
    const result = await backend.query({
        q: filters.query ?? "",
        limit,
        offset,
        filters: meiliFilters,
        facets: ["weightClass", "balance", "shaftFlex", "gripSize", "condition", "gender"],
    });
    logger.info("search:meilisearch_query", {
        q: filters.query ?? "",
        durationMs: Date.now() - start,
        hitCount: result.hits.length,
        estimatedTotal: result.estimatedTotal,
    });

    const page = filters.page ?? 1;
    const total = result.estimatedTotal;

    if (result.hits.length === 0) {
        return {
            products: [],
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
            facets: result.facetDistribution ?? null,
        };
    }

    // Hydrate from DB for fields not stored in the index (images, stock, etc.)
    const ids = result.hits.map((h) => h.id);
    const conditions = [eq(products.status, "PUBLISHED"), inArray(products.id, ids)];
    if (filters.minPrice !== undefined) conditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${filters.minPrice}`);
    if (filters.maxPrice !== undefined) conditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${filters.maxPrice}`);
    if (filters.category) {
        const categoryRecord = await db.query.categories.findFirst({ where: eq(categories.slug, filters.category) });
        if (categoryRecord) conditions.push(eq(products.category_id, categoryRecord.id));
    }

    const rows = await db.query.products.findMany({
        where: and(...conditions),
        with: {
            category: true,
            seller: { columns: { id: true, name: true, image: true, store_name: true, store_slug: true } },
        },
    });

    // Preserve Meilisearch ranking order.
    const indexById = new Map(rows.map((row) => [row.id, row]));
    const ordered = ids.map((id) => indexById.get(id)).filter(Boolean) as typeof rows;

    return {
        products: ordered,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
        facets: result.facetDistribution ?? null,
    };
}

export async function searchProducts(filters: SearchFilters) {
    if (isMeilisearchActive()) {
        try {
            return await searchProductsViaMeilisearch(filters);
        } catch (error) {
            logger.warn("search:meilisearch_fallback_to_postgres", { error: String(error) });
            // Fall through to Postgres path on adapter failure.
        }
    }

    const {
        query,
        category,
        minPrice,
        maxPrice,
        condition,
        gender,
        sortBy = "relevance",
        page = 1,
        limit = 20,
        weightClass,
        balance,
        shaftFlex,
        gripSize,
        minTensionLbs,
    } = filters;

    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions = [eq(products.status, "PUBLISHED")];

    // Fuzzy search - match each word individually
    if (query.trim()) {
        const variants = getSearchVariants(query);
        if (variants.length > 0) {
            const wordConditions = variants.map((variant) =>
                or(
                    ilike(products.title, `%${variant}%`),
                    ilike(products.description, `%${variant}%`),
                    ilike(products.brand, `%${variant}%`),
                    sql`REPLACE(LOWER(${products.brand}), ' ', '') LIKE ${`%${variant.replace(/\s+/g, "")}%`}`
                )
            );
            // Match ANY word (OR logic for broader results)
            conditions.push(or(...wordConditions)!);
        }
    }

    // Category filter
    if (category) {
        const categoryRecord = await db.query.categories.findFirst({
            where: eq(categories.slug, category),
        });
        if (categoryRecord) {
            conditions.push(eq(products.category_id, categoryRecord.id));
        }
    }

    // Price range
    if (minPrice !== undefined) {
        conditions.push(sql`CAST(${products.price} AS NUMERIC) >= ${minPrice}`);
    }
    if (maxPrice !== undefined) {
        conditions.push(sql`CAST(${products.price} AS NUMERIC) <= ${maxPrice}`);
    }

    // Condition filter
    if (condition) {
        conditions.push(eq(products.condition, condition));
    }

    // Gender filter
    if (gender) {
        conditions.push(eq(products.gender, gender));
    }

    // NICHE-02: spec filters.
    if (weightClass && weightClass.length > 0) {
        conditions.push(inArray(products.weight_class, weightClass));
    }
    if (balance && balance.length > 0) {
        conditions.push(inArray(products.balance, balance));
    }
    if (shaftFlex && shaftFlex.length > 0) {
        conditions.push(inArray(products.shaft_flex, shaftFlex));
    }
    if (gripSize && gripSize.length > 0) {
        conditions.push(inArray(products.grip_size, gripSize));
    }
    if (minTensionLbs !== undefined) {
        conditions.push(gte(products.max_string_tension_lbs, minTensionLbs));
    }

    // Determine sort order
    let orderBy;
    switch (sortBy) {
        case "price_asc":
            orderBy = asc(sql`CAST(${products.price} AS NUMERIC)`);
            break;
        case "price_desc":
            orderBy = desc(sql`CAST(${products.price} AS NUMERIC)`);
            break;
        case "newest":
            orderBy = desc(products.created_at);
            break;
        case "popular":
            orderBy = desc(products.views);
            break;
        default: // relevance - newest first for now
            orderBy = desc(products.created_at);
    }

    // Get total count
    const countResult = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(products)
        .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Get products
    const results = await db.query.products.findMany({
        where: and(...conditions),
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
            category: true,
        },
        orderBy: [orderBy],
        limit,
        offset,
    });

    return {
        products: results,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
    };
}

// ============================================
// SEARCH AUTOCOMPLETE
// ============================================
export async function searchAutocomplete(query: string, limit = 8) {
    if (!query.trim() || query.trim().length < 2) {
        return { suggestions: [], categories: [] };
    }

    const variants = getSearchVariants(query);
    const patterns = variants.length > 0 ? variants : [query.trim().toLowerCase()];

    // Get matching products
    const productResults = await db
        .select({
            id: products.id,
            title: products.title,
            slug: products.slug,
            price: products.price,
            images: products.images,
        })
        .from(products)
        .where(
            and(
                eq(products.status, "PUBLISHED"),
                or(
                    ...patterns.map((pattern) =>
                        or(
                            ilike(products.title, `%${pattern}%`),
                            ilike(products.brand, `%${pattern}%`),
                            sql`REPLACE(LOWER(${products.brand}), ' ', '') LIKE ${`%${pattern.replace(/\s+/g, "")}%`}`
                        )
                    )
                )!
            )
        )
        .limit(limit);

    // Get matching categories
    const categoryResults = await db
        .select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            icon: categories.icon,
        })
        .from(categories)
        .where(
            or(
                ...patterns.map((pattern) => ilike(categories.name, `%${pattern}%`))
            )!
        )
        .limit(3);

    return {
        suggestions: productResults.map((p) => ({
            type: "product" as const,
            id: p.id,
            title: p.title,
            slug: p.slug,
            price: p.price,
            image: p.images?.[0] || null,
        })),
        categories: categoryResults.map((c) => ({
            type: "category" as const,
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: c.icon,
        })),
    };
}

// ============================================
// GET RECENT SEARCHES (stored in localStorage on client)
// ============================================
export async function getPopularSearches() {
    // Get products with most views as popular searches
    const popularProducts = await db
        .select({
            title: products.title,
        })
        .from(products)
        .where(eq(products.status, "PUBLISHED"))
        .orderBy(desc(products.views))
        .limit(5);

    return popularProducts.map((p) => p.title);
}

// ============================================
// GET SEARCH FILTERS
// ============================================
export async function getSearchFilters() {
    // Get all categories
    const allCategories = await db.query.categories.findMany({
        columns: {
            id: true,
            name: true,
            slug: true,
            icon: true,
        },
        orderBy: [asc(categories.name)],
    });

    // Get price range
    const priceRange = await db
        .select({
            min: sql<string>`MIN(CAST(${products.price} AS NUMERIC))`,
            max: sql<string>`MAX(CAST(${products.price} AS NUMERIC))`,
        })
        .from(products)
        .where(eq(products.status, "PUBLISHED"));

    return {
        categories: allCategories,
        priceRange: {
            min: parseFloat(priceRange[0]?.min || "0"),
            max: parseFloat(priceRange[0]?.max || "10000000"),
        },
        conditions: [
            { value: "NEW", label: "Baru" },
            { value: "PRELOVED", label: "Preloved" },
        ],
        genders: [
            { value: "UNISEX", label: "Unisex" },
            { value: "MEN", label: "Pria" },
            { value: "WOMEN", label: "Wanita" },
        ],
        sortOptions: [
            { value: "relevance", label: "Paling Relevan" },
            { value: "newest", label: "Terbaru" },
            { value: "popular", label: "Terpopuler" },
            { value: "price_asc", label: "Harga: Terendah" },
            { value: "price_desc", label: "Harga: Tertinggi" },
        ],
    };
}
