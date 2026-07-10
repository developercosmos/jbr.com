"use server";

import { db } from "@/db";
import { categories, products, product_variants, order_items, users } from "@/db/schema";
import { SPORT_VALUES } from "@/lib/sports";
import { ensureCurrentUserCanSell } from "@/actions/seller";
import { ensureCompanyHasT2Application, ensureSellerCanPriceProduct } from "@/actions/kyc";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { headers } from "next/headers";
import { eq, desc, and, inArray } from "drizzle-orm";
import { revalidatePath, unstable_cache } from "next/cache";
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
    sport: z.enum(SPORT_VALUES).optional().nullable(),
    video_url: z.string().max(512).optional().nullable(),
    video_position: z.number().int().min(0).max(60).optional(),
    price: z.number().positive(),
    condition: z.enum(["NEW", "PRELOVED"]),
    condition_rating: z.number().min(1).max(10).optional(),
    condition_notes: z.string().optional(),
    condition_checklist: z.array(z.string().max(80)).max(12).optional(),
    weight_grams: z.number().positive().optional(),
    // Racket spec fields (NICHE). Values match the search filter + /compare option
    // sets so seller input is filterable and comparable. Empty string -> null.
    weight_class: z.enum(["2U", "3U", "4U", "5U", "6U"]).optional().nullable(),
    balance: z.enum(["HEAD_HEAVY", "EVEN", "HEAD_LIGHT"]).optional().nullable(),
    shaft_flex: z.enum(["STIFF", "MEDIUM", "FLEXIBLE"]).optional().nullable(),
    grip_size: z.enum(["G2", "G3", "G4", "G5", "G6"]).optional().nullable(),
    max_string_tension_lbs: z.number().int().min(15).max(40).optional().nullable(),
    stiffness_rating: z.number().int().min(1).max(10).optional().nullable(),
    stock: z.number().int().positive().default(1),
    category_id: z.string().uuid().optional(),
    images: z.array(productImageSchema).default([]),
    bargain_enabled: z.boolean().optional().default(false),
    floor_price: z.number().positive().optional(),
    tiered_floor_price: z
        .object({
            default: z.number().positive().optional(),
            high_trust: z.number().positive().optional(),
            platinum_buyer: z.number().positive().optional(),
        })
        .optional(),
    // Optional product variants (e.g. grip size / color). When present, the sum of
    // variant stock is the real sellable inventory; cart/checkout enforce variant
    // selection. Empty/omitted => simple single-SKU product.
    variants: z
        .array(
            z.object({
                name: z.string().trim().min(1).max(80),
                variant_type: z.string().trim().min(1).max(30).default("varian"),
                // Combination axes (e.g. option1=Warna/Merah, option2=Ukuran/M).
                option1_name: z.string().trim().max(30).optional().nullable(),
                option1_value: z.string().trim().max(60).optional().nullable(),
                option2_name: z.string().trim().max(30).optional().nullable(),
                option2_value: z.string().trim().max(60).optional().nullable(),
                price: z.number().positive().optional().nullable(),
                stock: z.number().int().min(0).default(1),
                images: z.array(productImageSchema).max(8).optional(),
            })
        )
        .max(100)
        .optional(),
});

const updateProductSchema = createProductSchema.partial().extend({
    id: z.string().uuid(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    // Drop the create-time defaults here. .partial() keeps `.default(...)`, so a
    // partial update that omits these (e.g. publishProduct sends only {id,status})
    // would otherwise reset stock→1 / images→[] / bargain_enabled→false and
    // clobber the saved values. Plain optional => omitted means "leave as-is".
    stock: z.number().int().positive().optional(),
    images: z.array(productImageSchema).optional(),
    bargain_enabled: z.boolean().optional(),
});

// Helper to generate slug
function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        + "-" + Date.now().toString(36);
}

function normalizeChecklist(input?: string[]): string[] {
    return Array.from(new Set((input ?? []).map((item) => item.trim()).filter(Boolean)));
}

function validatePrelovedChecklist(input: { condition: "NEW" | "PRELOVED"; checklist?: string[] }): {
    checklist: string[];
    requiresModeration: boolean;
    moderationReason: string | null;
} {
    if (input.condition !== "PRELOVED") {
        return { checklist: [], requiresModeration: false, moderationReason: null };
    }

    // Checklist bersifat OPSIONAL — boleh kosong. Saat diisi dan ada penanda
    // kerusakan struktural, produk tetap masuk moderasi demi keamanan pembeli.
    const checklist = normalizeChecklist(input.checklist);
    const riskItems = checklist.filter((item) => /retak|struktural|patah/i.test(item));
    const hasRiskMarker = riskItems.length > 0;
    return {
        checklist,
        requiresModeration: hasRiskMarker,
        moderationReason: hasRiskMarker
            ? `Checklist kondisi menandai potensi kerusakan struktural (${riskItems.join(", ")}). Produk pre-loved seperti ini ditinjau manual demi keamanan pembeli — perbaiki/lengkapi deskripsi & foto kerusakan, lalu simpan untuk diajukan ulang.`
            : null,
    };
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
            sport: row.sport,
        });
    } catch {
        // Sync errors are non-fatal — the nightly reconcile will fix drift.
    }
}

/** Batas video produk (configurable: product.video_max_mb / product.video_max_seconds). */
export async function getProductVideoLimits(): Promise<{ maxMb: number; maxSeconds: number }> {
    const { getSetting } = await import("@/actions/accounting/settings");
    const [maxMb, maxSeconds] = await Promise.all([
        getSetting<number>("product.video_max_mb", { defaultValue: 10 }),
        getSetting<number>("product.video_max_seconds", { defaultValue: 60 }),
    ]);
    return {
        maxMb: Number(maxMb ?? 10) || 10,
        maxSeconds: Number(maxSeconds ?? 60) || 60,
    };
}

export async function createProduct(input: z.infer<typeof createProductSchema>) {
    try {
        const user = await getCurrentUser();
        await ensureCurrentUserCanSell();
        const validated = createProductSchema.parse(input);
        logger.info("product:create_input", {
            actorId: user.id,
            imgCount: validated.images.length,
            img0: validated.images[0]?.slice(0, 70) ?? null,
            variantImgs: (validated.variants ?? []).filter((v) => (v.images?.length ?? 0) > 0).length,
        });
        // Defense-in-depth: the form requires >=1 photo, but the schema's default([])
        // would otherwise let a dropped upload (empty images) persist a photoless
        // product. Mirror the client rule — a combination product may carry its
        // photos per-variant instead of as general product photos.
        const hasVariantImage = (validated.variants ?? []).some((v) => (v.images?.length ?? 0) > 0);
        if (validated.images.length === 0 && !hasVariantImage) {
            throw new Error("Minimal 1 foto produk atau foto varian wajib diupload.");
        }
        // Akun COMPANY wajib sudah mengajukan KYC T2 sebelum menerbitkan produk.
        await ensureCompanyHasT2Application(user.id);
        // Gate T0: harga (dasar + semua varian) dibatasi sampai seller naik tier.
        await ensureSellerCanPriceProduct(user.id, [
            validated.price,
            ...(validated.variants ?? []).map((v) => v.price ?? null),
        ]);
        const checklistPolicy = validatePrelovedChecklist({
            condition: validated.condition,
            checklist: validated.condition_checklist,
        });
        const nextStatus = checklistPolicy.requiresModeration ? "MODERATED" : "DRAFT";

        const { variants: variantInputs, ...productValues } = validated;
        const [product] = await db
            .insert(products)
            .values({
                ...productValues,
                condition_checklist: checklistPolicy.checklist,
                seller_id: user.id,
                slug: generateSlug(validated.title),
                price: validated.price.toString(),
                floor_price: validated.floor_price?.toString(),
                tiered_floor_price: validated.tiered_floor_price,
                status: nextStatus,
                moderation_reason: checklistPolicy.moderationReason,
            })
            .returning();
        logger.info("product:create_saved", {
            productId: product.id,
            savedImgCount: Array.isArray(product.images) ? product.images.length : -1,
        });

        // Insert variants (if any). product.stock stays as the aggregate the seller
        // entered; per-variant stock is the authoritative inventory at checkout.
        if (variantInputs && variantInputs.length > 0) {
            await db.insert(product_variants).values(
                variantInputs.map((v, i) => ({
                    product_id: product.id,
                    name: v.name,
                    variant_type: v.variant_type || "varian",
                    option1_name: v.option1_name ?? null,
                    option1_value: v.option1_value ?? null,
                    option2_name: v.option2_name ?? null,
                    option2_value: v.option2_value ?? null,
                    price: v.price != null ? v.price.toString() : null,
                    stock: v.stock,
                    images: v.images ?? [],
                    sort_order: i,
                }))
            );
            // Denormalized aggregate: products.stock = Σ variant stock so listing/card
            // surfaces (which read products.stock) reflect true variant inventory.
            const variantStockSum = variantInputs.reduce((sum, v) => sum + (v.stock ?? 0), 0);
            await db.update(products).set({ stock: variantStockSum }).where(eq(products.id, product.id));
        }

        if (validated.tiered_floor_price && Object.keys(validated.tiered_floor_price).length > 0) {
            logger.info("product:tier_floor_configured", {
                actorId: user.id,
                productId: product.id,
                tiers: Object.keys(validated.tiered_floor_price),
            });
        }

        revalidatePath("/seller/products");
        return { success: true as const, product };
    } catch (err) {
        const message =
            err instanceof Error && err.message.trim() ? err.message : "Gagal menyimpan produk";
        logger.warn("product:create_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function updateProductInternal(input: z.infer<typeof updateProductSchema>) {
    const user = await getCurrentUser();
    const validated = updateProductSchema.parse(input);

    const { id, variants: variantInputs, images: imagesPatch, ...updateData } = validated;
    // Verify ownership
    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, id), eq(products.seller_id, user.id)),
    });

    if (!existing) {
        throw new Error("Product not found or unauthorized");
    }

    logger.info("product:update_input", {
        productId: id,
        status: updateData.status ?? null,
        imagesPatch: imagesPatch === undefined ? "undef" : `len:${imagesPatch.length}`,
        existingImages: Array.isArray(existing.images) ? existing.images.length : -1,
    });

    // Gate T0: berlaku juga saat edit (harga baru ATAU harga lama yang dipertahankan).
    await ensureSellerCanPriceProduct(user.id, [
        updateData.price ?? Number(existing.price),
        ...(variantInputs ?? []).map((v) => v.price ?? null),
    ]);

    const finalCondition = (updateData.condition ?? existing.condition) as "NEW" | "PRELOVED";
    const checklistPolicy = validatePrelovedChecklist({
        condition: finalCondition,
        checklist: updateData.condition_checklist ?? (existing.condition_checklist ?? []),
    });

    // Re-moderation gates only content that was NEVER approved. A previously-approved
    // listing (approved_at set) that the seller merely un-archives goes straight back
    // to PUBLISHED instead of bouncing to MODERATED (bug #10).
    const isReactivationOfApproved =
        existing.status === "ARCHIVED" && updateData.status === "PUBLISHED" && existing.approved_at != null;
    const finalStatus =
        checklistPolicy.requiresModeration && updateData.status === "PUBLISHED" && !isReactivationOfApproved
            ? ("MODERATED" as const)
            : updateData.status;
    // Set the auto reason when auto-moderated; clear it when leaving moderation;
    // otherwise leave it untouched (so an admin-set reason isn't clobbered when a
    // seller just re-saves a still-moderated product).
    const moderationReasonPatch =
        finalStatus === "MODERATED" && checklistPolicy.requiresModeration
            ? { moderation_reason: checklistPolicy.moderationReason }
            : finalStatus !== "MODERATED"
                ? { moderation_reason: null }
                : {};
    const [product] = await db
        .update(products)
        .set({
            ...updateData,
            // Only (re)write images when the caller actually sends photos.
            // publishProduct/archiveProduct send only { id, status }; the schema's
            // images.default([]) must NEVER wipe a product's existing photos here.
            ...(Array.isArray(imagesPatch) && imagesPatch.length > 0 ? { images: imagesPatch } : {}),
            condition_checklist: finalCondition === "NEW" ? [] : checklistPolicy.checklist,
            price: updateData.price?.toString(),
            floor_price: updateData.floor_price?.toString(),
            tiered_floor_price: updateData.tiered_floor_price,
            status: finalStatus,
            ...moderationReasonPatch,
            // Stamp first approval so future un-archive skips re-moderation (bug #10).
            ...(finalStatus === "PUBLISHED" && !existing.approved_at ? { approved_at: new Date() } : {}),
            updated_at: new Date(),
        })
        .where(eq(products.id, id))
        .returning();
    logger.info("product:update_saved", {
        productId: id,
        savedImages: Array.isArray(product.images) ? product.images.length : -1,
    });

    // Replace variant set when the editor submits one. Undefined => leave variants
    // untouched (edit of a non-variant field); [] => explicitly clear all variants.
    if (variantInputs !== undefined) {
        await db.delete(product_variants).where(eq(product_variants.product_id, id));
        if (variantInputs.length > 0) {
            await db.insert(product_variants).values(
                variantInputs.map((v, i) => ({
                    product_id: id,
                    name: v.name,
                    variant_type: v.variant_type || "varian",
                    option1_name: v.option1_name ?? null,
                    option1_value: v.option1_value ?? null,
                    option2_name: v.option2_name ?? null,
                    option2_value: v.option2_value ?? null,
                    price: v.price != null ? v.price.toString() : null,
                    stock: v.stock,
                    images: v.images ?? [],
                    sort_order: i,
                }))
            );
        }
        // Keep products.stock as the Σ of variant stock (denormalized aggregate). When
        // variants are cleared ([]), the seller-entered product-level stock stands.
        if (variantInputs.length > 0) {
            const variantStockSum = variantInputs.reduce((sum, v) => sum + (v.stock ?? 0), 0);
            await db.update(products).set({ stock: variantStockSum }).where(eq(products.id, id));
        }
    }

    if (updateData.tiered_floor_price && Object.keys(updateData.tiered_floor_price).length > 0) {
        logger.info("product:tier_floor_updated", {
            actorId: user.id,
            productId: product.id,
            tiers: Object.keys(updateData.tiered_floor_price),
        });
    }

    revalidatePath("/seller/products");
    revalidatePath(`/product/${product.slug}`);
    void syncProductToIndex(product.id, "upsert");
    return { success: true as const, product };
}

/**
 * Errors are RETURNED, not thrown: thrown server-action errors get masked by
 * Next.js in production ("An error occurred in the Server Components render"),
 * which hid the T0 price-gate message from sellers on the edit form.
 */
export async function updateProduct(input: z.infer<typeof updateProductSchema>) {
    try {
        return await updateProductInternal(input);
    } catch (err) {
        const message =
            err instanceof z.ZodError
                ? err.issues[0]?.message ?? "Data produk tidak valid"
                : err instanceof Error && err.message.trim()
                    ? err.message
                    : "Gagal menyimpan perubahan";
        logger.warn("product:update_failed", { productId: input?.id, error: message });
        return { success: false as const, error: message };
    }
}

export async function deleteProduct(productId: string) {
    const user = await getCurrentUser();

    // Verify ownership
    const existing = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.seller_id, user.id)),
        columns: { id: true, slug: true },
    });

    if (!existing) {
        throw new Error("Product not found or unauthorized");
    }

    // A product that has EVER been transacted must not be hard-deleted: order_items
    // FK-references it (RESTRICT) and order history must survive. Inactivate
    // (ARCHIVED) instead so it leaves the catalog but the record + history remain.
    const transacted = await db
        .select({ id: order_items.id })
        .from(order_items)
        .where(eq(order_items.product_id, productId))
        .limit(1);

    if (transacted.length > 0) {
        await db
            .update(products)
            .set({ status: "ARCHIVED", updated_at: new Date() })
            .where(eq(products.id, productId));
        revalidatePath("/seller/products");
        revalidatePath(`/product/${existing.slug}`);
        void syncProductToIndex(productId, "delete"); // drop from search — no longer listed
        return { success: true as const, archived: true as const };
    }

    await db.delete(products).where(eq(products.id, productId));

    revalidatePath("/seller/products");
    void syncProductToIndex(productId, "delete");
    return { success: true as const, archived: false as const };
}

export async function getSellerProducts() {
    const user = await getCurrentUser();

    const sellerProducts = await db.query.products.findMany({
        where: eq(products.seller_id, user.id),
        orderBy: [desc(products.created_at)],
        with: {
            category: true,
        },
        // PERF: safety bound so a seller with a pathological listing count can't load
        // an unbounded result set. Realistic catalogs are far below this; served by
        // idx_products_seller_id. (Add real pagination if any seller approaches it.)
        limit: 1000,
    });

    return sellerProducts;
}

export async function getSellerProductById(productId: string) {
    const user = await getCurrentUser();

    const product = await db.query.products.findFirst({
        where: and(eq(products.id, productId), eq(products.seller_id, user.id)),
        with: {
            category: true,
            variants: true,
        },
    });

    return product ?? null;
}

export async function getPublishedProducts(limit = 20, offset = 0, condition?: "NEW" | "PRELOVED") {
    const publishedProducts = await db.query.products.findMany({
        where: condition
            ? and(eq(products.status, "PUBLISHED"), eq(products.condition, condition))
            : eq(products.status, "PUBLISHED"),
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
                    tier: true,
                },
            },
            category: true,
            variants: true,
        },
    });

    return publishedProducts;
}

// PERF: the PDP is the hottest page; its product read is pure (slug -> 2 queries,
// no session/headers). Cache it in the Next Data Cache (revalidate 300 — the page's
// originally-intended ISR window) so repeat views don't re-hit Postgres. Edits +
// stock changes ride the 300s TTL; checkout re-validates stock server-side, so a
// brief stale display is safe (this matches the page's pre-existing revalidate=300).
export async function getProductBySlug(slug: string) {
    return unstable_cache(
        () => getProductBySlugUncached(slug),
        ["product-by-slug", slug],
        // Short TTL so stock mutations (order/cancel/restock/expiry, seller edits) show
        // within ~1 min instead of up to 5. (Next 16's revalidateTag(tag, profile)
        // tag-invalidation isn't wired here; the shorter window is the pragmatic fix.)
        { revalidate: 60 }
    )();
}

async function getProductBySlugUncached(slug: string) {
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
                    email_verified: true,
                    tier: true,
                    store_status: true,
                    store_reviewed_at: true,
                    created_at: true,
                },
            },
            category: true,
            variants: true,
        },
    });

    if (!product?.seller) {
        return product;
    }

    const firstPublishedListing = await db.query.products.findFirst({
        where: and(
            eq(products.seller_id, product.seller.id),
            eq(products.status, "PUBLISHED")
        ),
        columns: {
            created_at: true,
        },
        orderBy: [asc(products.created_at)],
    });

    const sellerHasPublishedListing = Boolean(firstPublishedListing);
    const sellerJoinAt = sellerHasPublishedListing
        ? (product.seller.store_reviewed_at ?? firstPublishedListing?.created_at ?? null)
        : null;

    return {
        ...product,
        seller: {
            ...product.seller,
            first_published_product_at: firstPublishedListing?.created_at ?? null,
            seller_has_published_listing: sellerHasPublishedListing,
            seller_join_at: sellerJoinAt,
        },
    };
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

    // Search filter — matches product title/description/brand AND the seller's
    // store name (so searching a shop name surfaces that shop's products).
    if (filters.search) {
        const term = `%${filters.search}%`;
        conditions.push(
            or(
                ilike(products.title, term),
                ilike(products.description, term),
                ilike(products.brand, term),
                inArray(
                    products.seller_id,
                    db.select({ id: users.id }).from(users).where(ilike(users.store_name, term))
                )
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
                    tier: true,
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

