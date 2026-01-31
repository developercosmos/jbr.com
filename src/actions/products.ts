"use server";

import { db } from "@/db";
import { products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Validation schemas
const createProductSchema = z.object({
    title: z.string().min(3).max(200),
    description: z.string().optional(),
    price: z.number().positive(),
    condition: z.enum(["NEW", "PRELOVED"]),
    condition_rating: z.number().min(1).max(10).optional(),
    condition_notes: z.string().optional(),
    weight_grams: z.number().positive().optional(),
    stock: z.number().int().positive().default(1),
    category_id: z.string().uuid().optional(),
    images: z.array(z.string().url()).default([]),
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

export async function createProduct(input: z.infer<typeof createProductSchema>) {
    const user = await getCurrentUser();
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
    return { success: true };
}

export async function getSellerProducts() {
    const user = await getCurrentUser();

    const sellerProducts = await db.query.products.findMany({
        where: eq(products.seller_id, user.id),
        orderBy: [desc(products.created_at)],
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
