"use server";

import { db } from "@/db";
import { product_variants } from "@/db/schema";
import { eq, asc } from "drizzle-orm";

// ============================================
// GET PRODUCT VARIANTS
// ============================================
export async function getProductVariants(productId: string) {
    const variants = await db.query.product_variants.findMany({
        where: eq(product_variants.product_id, productId),
        orderBy: [asc(product_variants.sort_order), asc(product_variants.name)],
    });

    // Group variants by type
    const grouped: Record<string, typeof variants> = {};
    for (const variant of variants) {
        if (!grouped[variant.variant_type]) {
            grouped[variant.variant_type] = [];
        }
        grouped[variant.variant_type].push(variant);
    }

    return {
        variants,
        grouped,
        hasVariants: variants.length > 0,
    };
}

// ============================================
// GET VARIANT BY ID
// ============================================
export async function getVariantById(variantId: string) {
    return db.query.product_variants.findFirst({
        where: eq(product_variants.id, variantId),
    });
}

// ============================================
// CHECK VARIANT AVAILABILITY
// ============================================
export async function checkVariantAvailability(variantId: string, quantity: number = 1) {
    const variant = await db.query.product_variants.findFirst({
        where: eq(product_variants.id, variantId),
    });

    if (!variant) {
        return { available: false, message: "Variant not found" };
    }

    if (!variant.is_available) {
        return { available: false, message: "Variant is not available" };
    }

    if (variant.stock < quantity) {
        return { available: false, message: `Only ${variant.stock} items available` };
    }

    return { available: true, variant };
}

// ============================================
// GET AVAILABLE VARIANTS COUNT
// ============================================
export async function getAvailableVariantsCount(productId: string) {
    const variants = await db.query.product_variants.findMany({
        where: eq(product_variants.product_id, productId),
    });

    const available = variants.filter((v) => v.is_available && v.stock > 0);
    const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);

    return {
        total: variants.length,
        available: available.length,
        totalStock,
    };
}
