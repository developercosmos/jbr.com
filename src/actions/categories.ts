"use server";

import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Get current user with admin check
async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const user = await db.query.users.findFirst({
        where: eq(db._.fullSchema.users.id, session.user.id),
    });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Forbidden: Admin access required");
    }

    return session.user;
}

// ============================================
// PUBLIC CATEGORY ACTIONS
// ============================================

export async function getCategories() {
    const allCategories = await db.query.categories.findMany({
        orderBy: [desc(categories.created_at)],
    });
    return allCategories;
}

export async function getCategoriesWithCount() {
    const result = await db
        .select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            image: categories.image,
            parent_id: categories.parent_id,
            created_at: categories.created_at,
            productCount: count(products.id),
        })
        .from(categories)
        .leftJoin(products, eq(categories.id, products.category_id))
        .groupBy(categories.id)
        .orderBy(categories.name);

    return result;
}

export async function getCategoryBySlug(slug: string) {
    const category = await db.query.categories.findFirst({
        where: eq(categories.slug, slug),
    });
    return category;
}

// ============================================
// ADMIN CATEGORY ACTIONS
// ============================================

type CreateCategoryInput = {
    name: string;
    slug: string;
    image?: string;
    parent_id?: string;
};

export async function createCategory(input: CreateCategoryInput) {
    await requireAdmin();

    // Check if slug already exists
    const existing = await db.query.categories.findFirst({
        where: eq(categories.slug, input.slug),
    });

    if (existing) {
        throw new Error("Category with this slug already exists");
    }

    const [category] = await db
        .insert(categories)
        .values({
            name: input.name,
            slug: input.slug,
            image: input.image || null,
            parent_id: input.parent_id || null,
        })
        .returning();

    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: true, category };
}

type UpdateCategoryInput = {
    id: string;
    name?: string;
    slug?: string;
    image?: string;
    parent_id?: string | null;
};

export async function updateCategory(input: UpdateCategoryInput) {
    await requireAdmin();

    const { id, ...updateData } = input;

    // Verify category exists
    const existing = await db.query.categories.findFirst({
        where: eq(categories.id, id),
    });

    if (!existing) {
        throw new Error("Category not found");
    }

    // Check if new slug already exists (if changing slug)
    if (updateData.slug && updateData.slug !== existing.slug) {
        const slugExists = await db.query.categories.findFirst({
            where: eq(categories.slug, updateData.slug),
        });
        if (slugExists) {
            throw new Error("Category with this slug already exists");
        }
    }

    const [category] = await db
        .update(categories)
        .set(updateData)
        .where(eq(categories.id, id))
        .returning();

    revalidatePath("/admin/categories");
    revalidatePath(`/category/${category.slug}`);
    return { success: true, category };
}

export async function deleteCategory(categoryId: string) {
    await requireAdmin();

    // Check if category has products
    const productsInCategory = await db.query.products.findFirst({
        where: eq(products.category_id, categoryId),
    });

    if (productsInCategory) {
        throw new Error("Cannot delete category with products. Move or delete products first.");
    }

    await db.delete(categories).where(eq(categories.id, categoryId));

    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: true };
}
