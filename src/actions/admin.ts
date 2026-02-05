"use server";

import { db } from "@/db";
import { users, products, orders, order_items, product_variants } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, count, sql, and, gte, ilike, or, exists, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { categories } from "@/db/schema";

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

// Get pending products count for sidebar badge (lightweight check)
export async function getPendingProductsCount(): Promise<number> {
    try {
        const [result] = await db
            .select({ count: count() })
            .from(products)
            .where(eq(products.status, "DRAFT"));
        return result?.count || 0;
    } catch {
        return 0;
    }
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
// PRODUCT MANAGEMENT
// ============================================

export async function getAdminProducts(filters?: {
    search?: string;
    status?: string;
    categoryId?: string;
}) {
    await getCurrentAdmin();

    const conditions = [];

    // Search filter (title, brand, slug, or seller store_name/name)
    // Supports variations like "Li-Ning", "Li Ning", "LiNing" by normalizing search
    if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        // Normalized search term (remove spaces, hyphens, underscores for fuzzy matching)
        const normalizedSearch = filters.search.replace(/[\s\-_]/g, '').toLowerCase();
        const normalizedSearchTerm = `%${normalizedSearch}%`;

        // Get seller IDs that match the search term
        const matchingSellers = db
            .select({ id: users.id })
            .from(users)
            .where(
                or(
                    ilike(users.store_name, searchTerm),
                    ilike(users.name, searchTerm),
                    // Normalized match for store_name
                    sql`LOWER(REPLACE(REPLACE(REPLACE(${users.store_name}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`,
                    sql`LOWER(REPLACE(REPLACE(REPLACE(${users.name}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`
                )
            );

        // Get product IDs that have matching SKU in variants
        const matchingVariants = db
            .select({ product_id: product_variants.product_id })
            .from(product_variants)
            .where(
                or(
                    ilike(product_variants.sku, searchTerm),
                    sql`LOWER(REPLACE(REPLACE(REPLACE(${product_variants.sku}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`
                )
            );

        conditions.push(
            or(
                // Regular search (case-insensitive)
                ilike(products.title, searchTerm),
                ilike(products.brand, searchTerm),
                ilike(products.slug, searchTerm),
                // Normalized search (removes spaces, hyphens, underscores)
                sql`LOWER(REPLACE(REPLACE(REPLACE(${products.title}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`,
                sql`LOWER(REPLACE(REPLACE(REPLACE(${products.brand}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`,
                // Seller match
                inArray(products.seller_id, matchingSellers),
                // SKU match
                inArray(products.id, matchingVariants)
            )
        );
    }

    // Status filter
    if (filters?.status && filters.status !== "all") {
        const statusMap: Record<string, string> = {
            active: "PUBLISHED",
            review: "DRAFT",
            moderated: "MODERATED",
            archived: "ARCHIVED",
        };
        const dbStatus = statusMap[filters.status.toLowerCase()] || filters.status;
        conditions.push(eq(products.status, dbStatus as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "MODERATED"));
    }

    // Category filter
    if (filters?.categoryId) {
        conditions.push(eq(products.category_id, filters.categoryId));
    }

    const allProducts = await db.query.products.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(products.created_at)],
        limit: 100,
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    store_name: true,
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

    return allProducts;
}

export async function getAdminCategories() {
    await getCurrentAdmin();

    const allCategories = await db.query.categories.findMany({
        orderBy: [desc(categories.name)],
    });

    return allCategories;
}

export async function adminDeleteProduct(productId: string) {
    await getCurrentAdmin();

    await db.delete(products).where(eq(products.id, productId));

    revalidatePath("/admin/products");
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

    revalidatePath("/admin/users");
    return { success: true };
}

export async function unbanUser(userId: string) {
    await getCurrentAdmin();

    await db
        .update(users)
        .set({ store_status: "ACTIVE", updated_at: new Date() })
        .where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
}

export async function deleteUser(userId: string) {
    const admin = await getCurrentAdmin();

    // Prevent admin from deleting themselves
    if (admin.id === userId) {
        throw new Error("Anda tidak dapat menghapus akun sendiri");
    }

    // Delete the user (cascade will handle related data based on DB constraints)
    await db.delete(users).where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
}

export async function updateUserRole(userId: string, role: "USER" | "ADMIN") {
    const admin = await getCurrentAdmin();

    // Prevent admin from demoting themselves
    if (admin.id === userId && role === "USER") {
        throw new Error("You cannot demote yourself");
    }

    await db
        .update(users)
        .set({ role, updated_at: new Date() })
        .where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
}

export async function updateUser(userId: string, data: {
    name?: string;
    email?: string;
    role?: "USER" | "ADMIN";
}) {
    const admin = await getCurrentAdmin();

    // Prevent admin from demoting themselves
    if (admin.id === userId && data.role === "USER") {
        throw new Error("You cannot demote yourself");
    }

    await db
        .update(users)
        .set({
            ...data,
            updated_at: new Date()
        })
        .where(eq(users.id, userId));

    revalidatePath("/admin/users");
    return { success: true };
}

export async function createUser(data: {
    name: string;
    email: string;
    password: string;
    role: "USER" | "ADMIN";
}) {
    await getCurrentAdmin();

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
        where: eq(users.email, data.email),
    });

    if (existingUser) {
        return { success: false, error: "Email sudah terdaftar" };
    }

    // Hash password using bcryptjs (same as Better Auth config)
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Generate UUIDs
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Create user
    const [newUser] = await db
        .insert(users)
        .values({
            id: userId,
            name: data.name,
            email: data.email,
            role: data.role,
            email_verified: true,
            created_at: new Date(),
            updated_at: new Date(),
        })
        .returning();

    // Create account with password
    const { accounts } = await import("@/db/schema");
    await db.insert(accounts).values({
        id: accountId,
        user_id: newUser.id,
        account_id: newUser.id,
        provider_id: "credential",
        password: hashedPassword,
        created_at: new Date(),
        updated_at: new Date(),
    });

    revalidatePath("/admin/users");
    return { success: true, userId: newUser.id };
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

// ============================================
// ANALYTICS
// ============================================
import { sum } from "drizzle-orm";

export async function getAnalyticsStats() {
    await getCurrentAdmin();

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // GMV - Total completed order value
    const [gmvResult] = await db
        .select({ total: sum(orders.total) })
        .from(orders)
        .where(eq(orders.status, "COMPLETED"));

    // Transaction counts by status
    const [completedOrdersResult] = await db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "COMPLETED"));

    const [pendingOrdersResult] = await db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.status, "PENDING_PAYMENT"));

    // Active users (sessions in last 30 days)
    const [activeUsersResult] = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${sessions.user_id})` })
        .from(sessions)
        .where(gte(sessions.expires_at, thirtyDaysAgo));

    // Products by category
    const categoryStats = await db
        .select({
            categoryName: categories.name,
            count: count(),
        })
        .from(products)
        .leftJoin(categories, eq(products.category_id, categories.id))
        .where(eq(products.status, "PUBLISHED"))
        .groupBy(categories.name);

    return {
        gmv: gmvResult?.total || "0",
        completedOrders: completedOrdersResult?.count || 0,
        pendingOrders: pendingOrdersResult?.count || 0,
        activeUsers: activeUsersResult?.count || 0,
        categoryDistribution: categoryStats,
    };
}

// ============================================
// DISPUTES MANAGEMENT
// ============================================
import { disputes, support_tickets, support_messages, sessions } from "@/db/schema";

export async function getDisputes(filters?: {
    search?: string;
    status?: string;
    priority?: string;
}) {
    await getCurrentAdmin();

    const conditions = [];

    // Normalized search
    if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        const normalizedSearch = filters.search.replace(/[\s\-_]/g, '').toLowerCase();
        const normalizedSearchTerm = `%${normalizedSearch}%`;

        conditions.push(
            or(
                ilike(disputes.title, searchTerm),
                ilike(disputes.dispute_number, searchTerm),
                ilike(disputes.description, searchTerm),
                sql`LOWER(REPLACE(REPLACE(REPLACE(${disputes.title}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`
            )
        );
    }

    if (filters?.status && filters.status !== "all") {
        conditions.push(eq(disputes.status, filters.status as any));
    }

    if (filters?.priority && filters.priority !== "all") {
        conditions.push(eq(disputes.priority, filters.priority as any));
    }

    const allDisputes = await db.query.disputes.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(disputes.created_at)],
        limit: 100,
        with: {
            reporter: {
                columns: { id: true, name: true, email: true, image: true },
            },
            reported: {
                columns: { id: true, name: true, store_name: true, image: true },
            },
            order: {
                columns: { id: true, order_number: true, total: true },
            },
        },
    });

    return allDisputes;
}

export async function updateDisputeStatus(
    disputeId: string,
    status: string,
    resolution?: string
) {
    const admin = await getCurrentAdmin();

    const updateData: any = {
        status,
        updated_at: new Date(),
    };

    if (status === "RESOLVED" || status === "CLOSED") {
        updateData.resolved_at = new Date();
        updateData.resolved_by = admin.id;
        if (resolution) {
            updateData.resolution = resolution;
        }
    }

    await db
        .update(disputes)
        .set(updateData)
        .where(eq(disputes.id, disputeId));

    revalidatePath("/admin/disputes");
    return { success: true };
}

// ============================================
// SUPPORT TICKETS MANAGEMENT
// ============================================

export async function getSupportTickets(filters?: {
    search?: string;
    status?: string;
    category?: string;
}) {
    await getCurrentAdmin();

    const conditions = [];

    // Normalized search
    if (filters?.search) {
        const searchTerm = `%${filters.search}%`;
        const normalizedSearch = filters.search.replace(/[\s\-_]/g, '').toLowerCase();
        const normalizedSearchTerm = `%${normalizedSearch}%`;

        conditions.push(
            or(
                ilike(support_tickets.subject, searchTerm),
                ilike(support_tickets.ticket_number, searchTerm),
                sql`LOWER(REPLACE(REPLACE(REPLACE(${support_tickets.subject}, ' ', ''), '-', ''), '_', '')) LIKE ${normalizedSearchTerm}`
            )
        );
    }

    if (filters?.status && filters.status !== "all") {
        conditions.push(eq(support_tickets.status, filters.status as any));
    }

    if (filters?.category && filters.category !== "all") {
        conditions.push(eq(support_tickets.category, filters.category as any));
    }

    const allTickets = await db.query.support_tickets.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(support_tickets.created_at)],
        limit: 100,
        with: {
            user: {
                columns: { id: true, name: true, email: true, image: true },
            },
            messages: {
                orderBy: [desc(support_messages.created_at)],
                limit: 1,
            },
        },
    });

    return allTickets;
}

export async function updateTicketStatus(ticketId: string, status: string) {
    await getCurrentAdmin();

    await db
        .update(support_tickets)
        .set({ status: status as any, updated_at: new Date() })
        .where(eq(support_tickets.id, ticketId));

    revalidatePath("/admin/support");
    return { success: true };
}

export async function replyToTicket(ticketId: string, message: string) {
    const admin = await getCurrentAdmin();

    await db.insert(support_messages).values({
        ticket_id: ticketId,
        sender_id: admin.id,
        is_admin: true,
        message,
    });

    // Update ticket status to IN_PROGRESS
    await db
        .update(support_tickets)
        .set({ status: "IN_PROGRESS", updated_at: new Date() })
        .where(eq(support_tickets.id, ticketId));

    revalidatePath("/admin/support");
    return { success: true };
}

export async function getTicketMessages(ticketId: string) {
    await getCurrentAdmin();

    const messages = await db.query.support_messages.findMany({
        where: eq(support_messages.ticket_id, ticketId),
        orderBy: [support_messages.created_at],
        with: {
            sender: {
                columns: { id: true, name: true, image: true },
            },
        },
    });

    return messages;
}
