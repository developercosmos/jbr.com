"use server";

import { db } from "@/db";
import { messages, conversations } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";
import { publish } from "@/lib/realtime";

export async function sendMessage({
    conversationId,
    content,
    attachmentUrl,
}: {
    conversationId: string;
    content: string;
    attachmentUrl?: string;
}) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const [message] = await db
        .insert(messages)
        .values({
            conversation_id: conversationId,
            sender_id: session.user.id,
            content,
            attachment_url: attachmentUrl,
        })
        .returning();

    // Update conversation's last message timestamp
    await db
        .update(conversations)
        .set({ last_message_at: new Date() })
        .where(eq(conversations.id, conversationId));

    // Publish message to realtime channel
    publish(`chat:${conversationId}`, "new_message", {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        attachment_url: message.attachment_url,
        is_read: message.is_read,
        created_at: message.created_at,
    });

    return message;
}

export async function getConversationMessages(conversationId: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const conversationMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.conversation_id, conversationId))
        .orderBy(desc(messages.created_at))
        .limit(50);

    return conversationMessages.reverse();
}

export async function getConversations() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const userConversations = await db.query.conversations.findMany({
        where: (conversations, { or, eq }) =>
            or(
                eq(conversations.buyer_id, session.user.id),
                eq(conversations.seller_id, session.user.id)
            ),
        orderBy: (conversations, { desc }) => [desc(conversations.last_message_at)],
        with: {
            buyer: true,
            seller: true,
            product: true,
        },
    });

    return userConversations;
}

export async function markMessagesAsRead(conversationId: string) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    await db
        .update(messages)
        .set({ is_read: true })
        .where(eq(messages.conversation_id, conversationId));

    return { success: true };
}
