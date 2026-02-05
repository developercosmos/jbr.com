"use server";

import { db } from "@/db";
import { follows } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// ============================================
// FOLLOW / UNFOLLOW STORE
// ============================================
export async function toggleFollow(sellerId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Can't follow yourself
    if (userId === sellerId) {
        return { success: false, error: "Cannot follow yourself" };
    }

    try {
        // Check if already following
        const existing = await db.query.follows.findFirst({
            where: and(
                eq(follows.follower_id, userId),
                eq(follows.following_id, sellerId)
            ),
        });

        if (existing) {
            // Unfollow
            await db.delete(follows).where(eq(follows.id, existing.id));
            revalidatePath(`/store`);
            return { success: true, isFollowing: false };
        } else {
            // Follow
            await db.insert(follows).values({
                follower_id: userId,
                following_id: sellerId,
            });
            revalidatePath(`/store`);
            return { success: true, isFollowing: true };
        }
    } catch (error) {
        console.error("[toggleFollow] Error:", error);
        return { success: false, error: "Failed to update follow status" };
    }
}

export async function checkIsFollowing(sellerId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return false;
    }

    const existing = await db.query.follows.findFirst({
        where: and(
            eq(follows.follower_id, session.user.id),
            eq(follows.following_id, sellerId)
        ),
    });

    return !!existing;
}

export async function getFollowerCount(sellerId: string) {
    const result = await db.query.follows.findMany({
        where: eq(follows.following_id, sellerId),
    });
    return result.length;
}
