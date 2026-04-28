"use server";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { ensureCurrentUserCanSell } from "@/actions/seller";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Product images may be:
//   - absolute URLs (https://cdn.example.com/foo.jpg)
//   - same-app private paths (/api/files/<uuid>)
//   - legacy relative paths from local storage (/uploads/...)
// Reject only obviously bogus values; any string starting with "/" or having a
// parseable URL is accepted.
const productImageSchema = z
    .string()
    .min(1, "URL gambar tidak boleh kosong")
    .max(2048, "URL gambar terlalu panjang")
    .refine(
        (value) => {
            if (value.startsWith("/")) return true;
            try {
                const parsed = new URL(value);
                return parsed.protocol === "http:" || parsed.protocol === "https:";
            } catch {
                return false;
            }
        },
        { message: "URL gambar tidak valid" }
    );

// Validation schemas
const createProductSchema = z.object({
    title: z.string().min(3).max(200),
    description: z.string().optional(),
    brand: z.string().optional(),
    gender: z.enum(["UNISEX", "MEN", "WOMEN"]).default("UNISEX"),
    price: z.number().positive(),
    condition: z.enum(["NEW", "PRELOVED"]),
    condition_rating: z.number().min(1).max(10).optional(),
    condition_notes: z.string().optional(),
    weight_grams: z.number().positive().optional(),
    stock: z.number().int().positive().default(1),
    category_id: z.string().uuid().optional(),
    images: z.array(productImageSchema).default([]),
});

const updateProductSchema = createProductSchema.partial().extend({
    id: z.string().uuid(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

// Helper to generate slug
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        + "-" + Date.now().toString(36);
}

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
// PRODUCT ACTIONS
// ============================================

// SRCH-03: index sync helper. Lazy-imports search backend to avoid pulling
// Meilisearch client into action bundles where unused.
async function syncProductToIndex(productId: string, op: "upsert" | "delete") {
    if (process.env.SEARCH_BACKEND !== "meilisearch") return;
    try {
        const { getSearchBackend } = await import("@/lib/search-backend");
        const backend = getSearchBackend();
        if (op === "delete") {
            await backend.deleteProduct?.(productId);
            return;
        }
        const row = await db.query.products.findFirst({ where: eq(products.id, productId) });
        if (!row || row.status !== "PUBLISHED") {
            await backend.deleteProduct?.(productId);
            return;
        }
        await backend.indexProduct?.({
            id: row.id,
            slug: row.slug,
            title: row.title,
            description: row.description,
            brand: row.brand,
            price: row.price,
            weightClass: row.weight_class,
            balance: row.balance,
            shaftFlex: row.shaft_flex,
            gripSize: row.grip_size,
        });
    } catch {
        // Sync errors are non-fatal — the nightly reconcile will fix drift.
    }
}

export async function createProduct(input: z.infer<typeof createProductSchema>) {
    const user = await getCurrentUser();
    await ensureCurrentUserCanSell();
    const validated = createProductSchema.parse(input);

    const [product] = await db
        .insert(products)
        .values({
            ...validated,
            seller_id: user.id,
            slug: generateSlug(validated.title),
            price: validated.price.toString(),
            status: "DRAFT",
        })
        .returning();

    revalidatePath("/seller/products");
    return { success: true, product };
}

export async function updateProduct(input: z.infer<typeof updateProductSchema>) {
    const user = await getCurrentUser();
    const validated = updateProductSchema.parse(input);

    const { id, ...updateData } = validated;

    // Verify ownership
    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.seller_id, user.id)),
    });

    if (!existing) {
        throw new Error("Product not found or unauthorized");
    }

    const [product] = await db
        .update(products)
        .set({
            ...updateData,
            price: updateData.price?.toString(),
            updated_at: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

    revalidatePath("/seller/products");
    revalidatePath(`/product/${product.slug}`);
    void syncProductToIndex(product.id, "upsert");
    return { success: true, product };
}

export async function deleteProduct(productId: string) {
    const user = await getCurrentUser();

    // Verify ownership
    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.seller_id, user.id)),
    });

    if (!existing) {
        throw new Error("Product not found or unauthorized");
    }

    await db.delete(products).where(eq(products.id, productId));

    revalidatePath("/seller/products");
    void syncProductToIndex(productId, "delete");
    return { success: true };
}

export async function getSellerProducts() {
    const user = await getCurrentUser();

    const sellerProducts = await db.query.products.findMany({
        where: eq(products.seller_id, user.id),
        orderBy: [desc(products.created_at)],
        with: {
            category: true,
        },
    });

    return sellerProducts;
}

export async function getPublishedProducts(limit = 20, offset = 0) {
    const publishedProducts = await db.query.products.findMany({
        where: eq(products.status, "PUBLISHED"),
        orderBy: [desc(products.created_at)],
        limit,
        offset,
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                    store_slug: true,
                    image: true,
                },
            },
            category: true,
            variants: true,
        },
    });

    return publishedProducts;
}

export async function getProductBySlug(slug: string) {
    const product = await db.query.products.findFirst({
        where: eq(products.slug, slug),
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                    store_slug: true,
                    store_description: true,
                    image: true,
                },
            },
            category: true,
            variants: true,
        },
    });

    return product;
}

export async function publishProduct(productId: string) {
    return updateProduct({ id: productId, status: "PUBLISHED" });
}

export async function archiveProduct(productId: string) {
    return updateProduct({ id: productId, status: "ARCHIVED" });
}

// ============================================
// FILTERING & BROWSE ACTIONS
// ============================================

import { or, asc, ilike, sql, count } from "drizzle-orm";

export type ProductFilters = {
    categorySlug?: string;
    gender?: "UNISEX" | "MEN" | "WOMEN";
    includeUnisex?: boolean;
    brand?: string;
    search?: string;
    condition?: "NEW" | "PRELOVED";
    minPrice?: number;
    maxPrice?: number;
    sortBy?: "newest" | "oldest" | "price_asc" | "price_desc";
    limit?: number;
    offset?: number;
};

export async function getFilteredProducts(filters: ProductFilters = {}) {
    const conditions = [eq(products.status, "PUBLISHED")];

    // Category filter
    if (filters.categorySlug) {
        const category = await db.query.categories.findFirst({
            where: eq(categories.slug, filters.categorySlug),
        });
        if (category) {
            conditions.push(eq(products.category_id, category.id));
        }
    }

    // Gender filter
    if (filters.gender) {
        if (filters.includeUnisex) {
            conditions.push(
                or(
                    eq(products.gender, filters.gender),
                    eq(products.gender, "UNISEX")
                )!
            );
        } else {
            conditions.push(eq(products.gender, filters.gender));
        }
    }

    // Brand filter
    if (filters.brand) {
        conditions.push(ilike(products.brand, filters.brand));
    }

    // Search filter
    if (filters.search) {
        conditions.push(
            or(
                ilike(products.title, `%${filters.search}%`),
                ilike(products.description, `%${filters.search}%`),
                ilike(products.brand, `%${filters.search}%`)
            )!
        );
    }

    // Condition filter
    if (filters.condition) {
        conditions.push(eq(products.condition, filters.condition));
    }

    // Price range
    if (filters.minPrice !== undefined) {
        conditions.push(sql`${products.price} >= ${filters.minPrice}`);
    }
    if (filters.maxPrice !== undefined) {
        conditions.push(sql`${products.price} <= ${filters.maxPrice}`);
    }

    // Sort
    let orderBy;
    switch (filters.sortBy) {
        case "oldest":
            orderBy = asc(products.created_at);
            break;
        case "price_asc":
            orderBy = asc(products.price);
            break;
        case "price_desc":
            orderBy = desc(products.price);
            break;
        case "newest":
        default:
            orderBy = desc(products.created_at);
    }

    const result = await db.query.products.findMany({
        where: and(...conditions),
        orderBy: [orderBy],
        limit: filters.limit || 24,
        offset: filters.offset || 0,
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                    store_slug: true,
                    image: true,
                },
            },
            category: {
                columns: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    });

    return result;
}

export async function getProductCount(filters: ProductFilters = {}): Promise<number> {
    const conditions = [eq(products.status, "PUBLISHED")];

    if (filters.categorySlug) {
        const category = await db.query.categories.findFirst({
            where: eq(categories.slug, filters.categorySlug),
        });
        if (category) {
            conditions.push(eq(products.category_id, category.id));
        }
    }

    if (filters.gender) {
        if (filters.includeUnisex) {
            conditions.push(
                or(
                    eq(products.gender, filters.gender),
                    eq(products.gender, "UNISEX")
                )!
            );
        } else {
            conditions.push(eq(products.gender, filters.gender));
        }
    }

    if (filters.brand) {
        conditions.push(ilike(products.brand, filters.brand));
    }

    if (filters.search) {
        conditions.push(
            or(
                ilike(products.title, `%${filters.search}%`),
                ilike(products.description, `%${filters.search}%`),
                ilike(products.brand, `%${filters.search}%`)
            )!
        );
    }

    if (filters.condition) {
        conditions.push(eq(products.condition, filters.condition));
    }

    const result = await db
        .select({ count: count() })
        .from(products)
        .where(and(...conditions));

    return result[0]?.count || 0;
}

export async function getBrands(): Promise<{ name: string; count: number }[]> {
    const { cached } = await import("@/lib/cache");
    return cached("catalog:brands:v1", 300, async () => {
        const result = await db
            .select({
                brand: products.brand,
                count: count(),
            })
            .from(products)
            .where(and(
                eq(products.status, "PUBLISHED"),
                sql`${products.brand} IS NOT NULL AND ${products.brand} != ''`
            ))
            .groupBy(products.brand)
            .orderBy(desc(count()));

        return result.map((r) => ({
            name: r.brand || "Unknown",
            count: r.count,
        }));
    });
}

