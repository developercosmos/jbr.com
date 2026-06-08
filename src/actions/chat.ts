"use server";

import { db } from "@/db";
import { categories, conversations, messages } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc, and, or, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notify";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
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
        const otherParty = firstRelation(isUserBuyer ? conv.seller : conv.buyer);
        const lastMessage = conv.messages[0] || null;

        return {
            id: conv.id,
            otherParty: {
                id: otherParty?.id || "",
                name: otherParty?.store_name || otherParty?.name || "Pengguna",
                image: otherParty?.image || null,
            },
            product: firstRelation(conv.product),
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
                    category_id: true,
                },
            },
        },
    });

    if (!conversation) {
        throw new Error("Conversation not found or access denied");
    }

    // DIF-12: lookup category slug separately. Nested `with` inside a `with`
    // tripped drizzle's relational query builder ("referencedTable undefined")
    // on some Postgres environments — keeping it as an explicit follow-up
    // fetch avoids the bug and is a single indexed lookup.
    let conversationCategory: { slug: string; name: string } | null = null;
    const conversationProduct = firstRelation(conversation.product) as
        | { category_id?: string | null }
        | null;
    if (conversationProduct?.category_id) {
        const category = await db.query.categories.findFirst({
            where: eq(categories.id, conversationProduct.category_id),
            columns: { slug: true, name: true },
        });
        if (category) {
            conversationCategory = { slug: category.slug, name: category.name };
        }
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
    const otherParty = firstRelation(isUserBuyer ? conversation.seller : conversation.buyer);

    return {
        conversation: {
            id: conversation.id,
            otherParty: {
                id: otherParty?.id || "",
                name: otherParty?.store_name || otherParty?.name || "Pengguna",
                image: otherParty?.image || null,
            },
            product: (() => {
                const p = firstRelation(conversation.product);
                if (!p) return null;
                return Object.assign({}, p, { category: conversationCategory });
            })(),
        },
        messages: conversationMessages.map((msg) => {
            const sender = firstRelation(msg.sender);
            return {
                id: msg.id,
                content: msg.content,
                attachmentUrl: msg.attachment_url,
                isFromMe: msg.sender_id === user.id,
                sender: {
                    id: sender?.id || "",
                    name: sender?.store_name || sender?.name || "Pengguna",
                    image: sender?.image || null,
                },
                isRead: msg.is_read,
                createdAt: msg.created_at,
            };
        }),
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

    // Cap message length to prevent abuse / oversized rows (DoS, storage bloat).
    const MAX_MESSAGE_LENGTH = 2000;
    if (content && content.trim().length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Pesan terlalu panjang (maksimal ${MAX_MESSAGE_LENGTH} karakter)`);
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
            // Stamp the conversation's product so the dispute/order audit-replay
            // timeline (which keys on product_reference_id) can surface this chat.
            product_reference_id: conversation.product_id ?? null,
            is_read: false,
        })
        .returning();

    // Update conversation's last_message_at
    await db
        .update(conversations)
        .set({ last_message_at: new Date() })
        .where(eq(conversations.id, conversationId));

    // Notify the recipient in-app. Email for chat is intentionally NOT sent per
    // message — it comes from the unanswered-1h CHAT_REMINDER sweep — so users
    // aren't flooded. A notify failure must never break sending the message.
    const recipientId = conversation.buyer_id === user.id ? conversation.seller_id : conversation.buyer_id;
    try {
        await notify({
            event: "NEW_MESSAGE",
            recipientUserId: recipientId,
            conversationId,
            senderName: user.name || "Pengguna",
            preview: content?.trim()?.slice(0, 140) || (attachmentUrl ? "📎 Mengirim lampiran" : "Pesan baru"),
            messageId: newMessage.id,
        });
    } catch (error) {
        console.error("chat:notify_failed", error);
    }

    revalidatePath("/messages");
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
    // Check auth without throwing
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return { error: "unauthorized", conversationId: null, isNew: false };
    }

    const user = session.user;

    if (user.id === sellerId) {
        return { error: "cannot_message_self", conversationId: null, isNew: false };
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

    revalidatePath("/messages");
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


// ============================================
// PDP-09 (chat surface): buyer reputation band for the SELLER viewing a chat.
// ============================================
// Returns the buyer's reputation band for a conversation, but ONLY when the
// caller is that conversation's SELLER. Delegates to getBuyerReputationSummary,
// which enforces the rate-limit (60/min), interaction-required check, audit log,
// and visibility resolution. Returns null when not applicable (caller is the
// buyer, no access, or no reputation data) so the UI simply shows no chip.
//
// IMPORTANT: call this ONCE when a conversation is opened, not on every chat
// poll — each call consumes the reputation rate-limit budget and writes an
// access-log row.
export async function getChatBuyerReputation(
    conversationId: string
): Promise<{ band: "LOW" | "MEDIUM" | "HIGH" } | null> {
    const user = await getCurrentUser();

    const conversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, conversationId),
        columns: { id: true, buyer_id: true, seller_id: true },
    });
    if (!conversation) return null;

    // Only the seller may see the buyer's reputation band.
    if (conversation.seller_id !== user.id) return null;

    try {
        const { getBuyerReputationSummary } = await import("@/actions/reputation");
        const rep = await getBuyerReputationSummary(conversation.buyer_id);
        if (rep && rep.visibility !== "none" && rep.band) {
            return { band: rep.band };
        }
        return null;
    } catch {
        // rate-limited / no interaction / error — no chip
        return null;
    }
}
