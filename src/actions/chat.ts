"use server";

import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, or, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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
// GET USER'S CONVERSATIONS
// ============================================
export async function getConversations() {
    const user = await getCurrentUser();

    const userConversations = await db.query.conversations.findMany({
        where: or(
            eq(conversations.buyer_id, user.id),
            eq(conversations.seller_id, user.id)
        ),
        orderBy: [desc(conversations.last_message_at)],
        with: {
            buyer: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                    store_name: true,
                },
            },
            seller: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                    store_name: true,
                },
            },
            product: {
                columns: {
                    id: true,
                    title: true,
                    price: true,
                    images: true,
                    condition: true,
                    condition_rating: true,
                    slug: true,
                },
            },
            messages: {
                orderBy: [desc(messages.created_at)],
                limit: 1,
                columns: {
                    content: true,
                    created_at: true,
                    sender_id: true,
                    is_read: true,
                },
            },
        },
    });

    // Transform to include other party info
    return userConversations.map((conv) => {
        const isUserBuyer = conv.buyer_id === user.id;
        const otherParty = isUserBuyer ? conv.seller : conv.buyer;
        const lastMessage = conv.messages[0] || null;

        return {
            id: conv.id,
            otherParty: {
                id: otherParty.id,
                name: otherParty.store_name || otherParty.name,
                image: otherParty.image,
            },
            product: conv.product,
            lastMessage: lastMessage
                ? {
                    content: lastMessage.content,
                    createdAt: lastMessage.created_at,
                    isFromMe: lastMessage.sender_id === user.id,
                    isRead: lastMessage.is_read,
                }
                : null,
            lastMessageAt: conv.last_message_at,
        };
    });
}

// ============================================
// GET MESSAGES FOR A CONVERSATION
// ============================================
export async function getMessages(conversationId: string) {
    const user = await getCurrentUser();

    // Verify user is part of this conversation
    const conversation = await db.query.conversations.findFirst({
        where: and(
            eq(conversations.id, conversationId),
            or(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, user.id)
            )
        ),
        with: {
            buyer: {
                columns: { id: true, name: true, image: true, store_name: true },
            },
            seller: {
                columns: { id: true, name: true, image: true, store_name: true },
            },
            product: {
                columns: {
                    id: true,
                    title: true,
                    price: true,
                    images: true,
                    condition: true,
                    condition_rating: true,
                    slug: true,
                },
            },
        },
    });

    if (!conversation) {
        throw new Error("Conversation not found or access denied");
    }

    // Get all messages for this conversation
    const conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversation_id, conversationId),
        orderBy: [asc(messages.created_at)],
        with: {
            sender: {
                columns: {
                    id: true,
                    name: true,
                    image: true,
                    store_name: true,
                },
            },
        },
    });

    // Mark unread messages from other party as read
    const otherPartyId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
    await db
        .update(messages)
        .set({ is_read: true })
        .where(
            and(
                eq(messages.conversation_id, conversationId),
                eq(messages.is_read, false),
                eq(messages.sender_id, otherPartyId)
            )
        );

    const isUserBuyer = conversation.buyer_id === user.id;
    const otherParty = isUserBuyer ? conversation.seller : conversation.buyer;

    return {
        conversation: {
            id: conversation.id,
            otherParty: {
                id: otherParty.id,
                name: otherParty.store_name || otherParty.name,
                image: otherParty.image,
            },
            product: conversation.product,
        },
        messages: conversationMessages.map((msg) => ({
            id: msg.id,
            content: msg.content,
            attachmentUrl: msg.attachment_url,
            isFromMe: msg.sender_id === user.id,
            sender: {
                id: msg.sender.id,
                name: msg.sender.store_name || msg.sender.name,
                image: msg.sender.image,
            },
            isRead: msg.is_read,
            createdAt: msg.created_at,
        })),
        currentUserId: user.id,
    };
}

// ============================================
// SEND A MESSAGE
// ============================================
export async function sendMessage(conversationId: string, content: string, attachmentUrl?: string) {
    const user = await getCurrentUser();

    if (!content?.trim() && !attachmentUrl) {
        throw new Error("Message content or attachment is required");
    }

    // Verify user is part of this conversation
    const conversation = await db.query.conversations.findFirst({
        where: and(
            eq(conversations.id, conversationId),
            or(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, user.id)
            )
        ),
    });

    if (!conversation) {
        throw new Error("Conversation not found or access denied");
    }

    // Insert new message
    const [newMessage] = await db
        .insert(messages)
        .values({
            conversation_id: conversationId,
            sender_id: user.id,
            content: content?.trim() || null,
            attachment_url: attachmentUrl || null,
            is_read: false,
        })
        .returning();

    // Update conversation's last_message_at
    await db
        .update(conversations)
        .set({ last_message_at: new Date() })
        .where(eq(conversations.id, conversationId));

    revalidatePath("/chat");

    return {
        id: newMessage.id,
        content: newMessage.content,
        attachmentUrl: newMessage.attachment_url,
        isFromMe: true,
        isRead: false,
        createdAt: newMessage.created_at,
    };
}

// ============================================
// START A NEW CONVERSATION (or get existing)
// ============================================
export async function startConversation(sellerId: string, productId?: string) {
    const user = await getCurrentUser();

    if (user.id === sellerId) {
        throw new Error("Cannot start a conversation with yourself");
    }

    // Check if conversation already exists
    let existingConversation;

    if (productId) {
        existingConversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, sellerId),
                eq(conversations.product_id, productId)
            ),
        });
    } else {
        existingConversation = await db.query.conversations.findFirst({
            where: and(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, sellerId)
            ),
        });
    }

    if (existingConversation) {
        return { conversationId: existingConversation.id, isNew: false };
    }

    // Create new conversation
    const [newConversation] = await db
        .insert(conversations)
        .values({
            buyer_id: user.id,
            seller_id: sellerId,
            product_id: productId || null,
        })
        .returning();

    revalidatePath("/chat");

    return { conversationId: newConversation.id, isNew: true };
}

// ============================================
// MARK MESSAGES AS READ
// ============================================
export async function markMessagesAsRead(conversationId: string) {
    const user = await getCurrentUser();

    // Get conversation to find other party
    const conversation = await db.query.conversations.findFirst({
        where: and(
            eq(conversations.id, conversationId),
            or(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, user.id)
            )
        ),
    });

    if (!conversation) {
        throw new Error("Conversation not found");
    }

    const otherPartyId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;

    await db
        .update(messages)
        .set({ is_read: true })
        .where(
            and(
                eq(messages.conversation_id, conversationId),
                eq(messages.sender_id, otherPartyId)
            )
        );

    return { success: true };
}

// ============================================
// GET UNREAD MESSAGE COUNT
// ============================================
export async function getUnreadCount(): Promise<number> {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return 0;
        }

        const user = session.user;

        // Get all conversations where user is participant
        const userConversations = await db.query.conversations.findMany({
            where: or(
                eq(conversations.buyer_id, user.id),
                eq(conversations.seller_id, user.id)
            ),
            columns: {
                id: true,
                buyer_id: true,
                seller_id: true,
            },
        });

        if (userConversations.length === 0) {
            return 0;
        }

        // Count unread messages from other parties
        let totalUnread = 0;

        for (const conv of userConversations) {
            const otherPartyId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id;

            const unreadMessages = await db.query.messages.findMany({
                where: and(
                    eq(messages.conversation_id, conv.id),
                    eq(messages.sender_id, otherPartyId),
                    eq(messages.is_read, false)
                ),
                columns: { id: true },
            });

            totalUnread += unreadMessages.length;
        }

        return totalUnread;
    } catch {
        return 0;
    }
}

