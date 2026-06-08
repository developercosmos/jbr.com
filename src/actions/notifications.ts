"use server";

import { db } from "@/db";
import { notifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Helper to get current user
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
// GET USER NOTIFICATIONS
// ============================================
export async function getNotifications(limit = 20, offset = 0) {
    const user = await getCurrentUser();

    const userNotifications = await db.query.notifications.findMany({
        // Hide rows the user opted out of in-app for (in_app_suppressed); the row
        // still exists as the idempotency / audit ledger.
        where: and(
            eq(notifications.user_id, user.id),
            eq(notifications.in_app_suppressed, false)
        ),
        orderBy: [desc(notifications.created_at)],
        limit,
        offset,
    });

    return userNotifications;
}

// ============================================
// GET UNREAD COUNT
// ============================================
export async function getUnreadNotificationCount(): Promise<number> {
    // For unauthenticated users, return 0 (don't throw)
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        return 0;
    }

    const result = await db
        .select({ count: count() })
        .from(notifications)
        .where(
            and(
                eq(notifications.user_id, session.user.id),
                eq(notifications.read, false),
                eq(notifications.in_app_suppressed, false)
            )
        );

    return result[0]?.count || 0;
}

// ============================================
// MARK AS READ
// ============================================
export async function markNotificationAsRead(notificationId: string) {
    const user = await getCurrentUser();

    await db
        .update(notifications)
        .set({
            read: true,
            read_at: new Date(),
        })
        .where(
            and(
                eq(notifications.id, notificationId),
                eq(notifications.user_id, user.id)
            )
        );

    revalidatePath("/profile/notifications");
    return { success: true };
}

// ============================================
// MARK ALL AS READ
// ============================================
export async function markAllNotificationsAsRead() {
    const user = await getCurrentUser();

    await db
        .update(notifications)
        .set({
            read: true,
            read_at: new Date(),
        })
        .where(
            and(
                eq(notifications.user_id, user.id),
                eq(notifications.read, false)
            )
        );

    revalidatePath("/profile/notifications");
    return { success: true };
}

// ============================================
// CREATE NOTIFICATION (internal use)
// ============================================
export async function createNotification(
    userId: string,
    type: "ORDER_CREATED" | "PAYMENT_SUCCESS" | "ORDER_SHIPPED" | "ORDER_DELIVERED" | "NEW_MESSAGE" | "NEW_REVIEW" | "REVIEW_REPLY" | "SYSTEM",
    title: string,
    message: string,
    data?: Record<string, unknown>
) {
    const [notification] = await db
        .insert(notifications)
        .values({
            user_id: userId,
            type,
            title,
            message,
            data,
        })
        .returning();

    return notification;
}

// ============================================
// DELETE OLD NOTIFICATIONS (cleanup)
// ============================================
export async function deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await db
        .delete(notifications)
        .where(sql`${notifications.created_at} < ${cutoffDate}`);

    return { success: true };
}
