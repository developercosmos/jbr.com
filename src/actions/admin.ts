"use server";

import { db } from "@/db";
import { users, products, orders, order_items } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, count, sql, and, gte } from "drizzle-orm";

// Get current admin user
async function getCurrentAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
    });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Admin access required");
    }

    return user;
}

// ============================================
// ADMIN DASHBOARD STATS
// ============================================

export async function getAdminDashboardStats() {
    await getCurrentAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get total users count
    const [totalUsersResult] = await db
        .select({ count: count() })
        .from(users);

    // Get new users this week
    const [newUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(gte(users.created_at, weekAgo));

    // Get sellers count (users with store_name)
    const [sellersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(sql`${users.store_name} IS NOT NULL`);

    // Get products by status
    const [pendingProductsResult] = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.status, "DRAFT"));

    const [publishedProductsResult] = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.status, "PUBLISHED"));

    const [moderatedProductsResult] = await db
        .select({ count: count() })
        .from(products)
        .where(eq(products.status, "MODERATED"));

    return {
        totalUsers: totalUsersResult?.count || 0,
        newUsersThisWeek: newUsersResult?.count || 0,
        totalSellers: sellersResult?.count || 0,
        pendingProducts: pendingProductsResult?.count || 0,
        publishedProducts: publishedProductsResult?.count || 0,
        moderatedProducts: moderatedProductsResult?.count || 0,
    };
}

// ============================================
// MODERATION QUEUE
// ============================================

export async function getModerationQueue() {
    await getCurrentAdmin();

    // Get products pending moderation (status = DRAFT from new sellers or flagged)
    const pendingProducts = await db.query.products.findMany({
        where: eq(products.status, "DRAFT"),
        orderBy: [desc(products.created_at)],
        limit: 50,
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                    image: true,
                    created_at: true,
                },
            },
            category: true,
        },
    });

    return pendingProducts;
}

export async function approveProduct(productId: string) {
    await getCurrentAdmin();

    await db
        .update(products)
        .set({ status: "PUBLISHED", updated_at: new Date() })
        .where(eq(products.id, productId));

    return { success: true };
}

export async function rejectProduct(productId: string) {
    await getCurrentAdmin();

    await db
        .update(products)
        .set({ status: "MODERATED", updated_at: new Date() })
        .where(eq(products.id, productId));

    return { success: true };
}

// ============================================
// USER MANAGEMENT
// ============================================

export async function getAdminUsers() {
    await getCurrentAdmin();

    const allUsers = await db.query.users.findMany({
        orderBy: [desc(users.created_at)],
        limit: 100,
    });

    return allUsers;
}

export async function banUser(userId: string) {
    await getCurrentAdmin();

    await db
        .update(users)
        .set({ store_status: "BANNED", updated_at: new Date() })
        .where(eq(users.id, userId));

    return { success: true };
}

export async function unbanUser(userId: string) {
    await getCurrentAdmin();

    await db
        .update(users)
        .set({ store_status: "ACTIVE", updated_at: new Date() })
        .where(eq(users.id, userId));

    return { success: true };
}

// ============================================
// ORDER MANAGEMENT
// ============================================

export async function getAdminOrders() {
    await getCurrentAdmin();

    const allOrders = await db.query.orders.findMany({
        orderBy: [desc(orders.created_at)],
        limit: 100,
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
                },
            },
            items: {
                with: {
                    product: {
                        columns: {
                            id: true,
                            title: true,
                            slug: true,
                            images: true,
                        },
                    },
                },
            },
        },
    });

    return allOrders;
}
