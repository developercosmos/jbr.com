"use server";

import { db } from "@/db";
import { follows, conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, or } from "drizzle-orm";
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

// ============================================
// START CHAT / GET OR CREATE CONVERSATION
// ============================================
export async function getOrCreateConversation(otherUserId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    const userId = session.user.id;

    // Can't chat with yourself
    if (userId === otherUserId) {
        return { success: false, error: "Cannot chat with yourself" };
    }

    try {
        // Check for existing conversation (either direction)
        const existing = await db.query.conversations.findFirst({
            where: or(
                and(
                    eq(conversations.buyer_id, userId),
                    eq(conversations.seller_id, otherUserId)
                ),
                and(
                    eq(conversations.buyer_id, otherUserId),
                    eq(conversations.seller_id, userId)
                )
            ),
        });

        if (existing) {
            return { success: true, conversationId: existing.id };
        }

        // Create new conversation
        const [newConversation] = await db
            .insert(conversations)
            .values({
                buyer_id: userId,
                seller_id: otherUserId,
            })
            .returning();

        return { success: true, conversationId: newConversation.id };
    } catch (error) {
        console.error("[getOrCreateConversation] Error:", error);
        return { success: false, error: "Failed to start conversation" };
    }
}
