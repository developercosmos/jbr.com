"use server";

import { db } from "@/db";
import { messages } from "@/db/schema";
import { and, eq, lt, asc } from "drizzle-orm";
import { notify } from "@/lib/notify";
import { logger } from "@/lib/logger";
import { assertInternalCall } from "@/lib/internal-guard";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

// A chat message left unread for this long triggers a one-time email reminder.
const UNANSWERED_MINUTES = 60;
// Safety cap per run; the sweep runs every 15 min so the backlog stays small.
const MAX_MESSAGES_PER_RUN = 500;

export interface ChatReminderSweepResult {
    inspected: number;
    reminded: number;
}

/**
 * Emails the recipient when a chat message has gone unread for >1 hour.
 * Fires once per (conversation, recipient) unanswered streak — keyed on the
 * OLDEST unread message id via notify()'s idempotency — so reading the chat
 * (which clears is_read) resets it, and new messages don't re-trigger until the
 * streak is cleared. Honors the recipient's `chat` email preference inside notify().
 */
export async function runUnansweredChatReminderSweep(internalToken?: string): Promise<ChatReminderSweepResult> {
    assertInternalCall(internalToken);
    const cutoff = new Date(Date.now() - UNANSWERED_MINUTES * 60 * 1000);

    const unread = await db.query.messages.findMany({
        where: and(eq(messages.is_read, false), lt(messages.created_at, cutoff)),
        orderBy: [asc(messages.created_at)],
        columns: {
            id: true,
            conversation_id: true,
            sender_id: true,
            content: true,
            attachment_url: true,
        },
        with: {
            sender: { columns: { name: true, store_name: true } },
            conversation: { columns: { buyer_id: true, seller_id: true } },
        },
        limit: MAX_MESSAGES_PER_RUN,
    });

    // Group by (conversation, recipient). Because rows are ordered oldest-first,
    // the FIRST one seen per key is the streak trigger we key idempotency on.
    const groups = new Map<
        string,
        { conversationId: string; recipientId: string; senderName: string; preview: string; messageId: string }
    >();

    for (const m of unread) {
        const conv = firstRelation(m.conversation);
        if (!conv) continue;
        const recipientId = m.sender_id === conv.buyer_id ? conv.seller_id : conv.buyer_id;
        if (!recipientId || recipientId === m.sender_id) continue;
        const key = `${m.conversation_id}:${recipientId}`;
        if (groups.has(key)) continue;
        const sender = firstRelation(m.sender);
        groups.set(key, {
            conversationId: m.conversation_id,
            recipientId,
            senderName: sender?.store_name || sender?.name || "Pengguna",
            preview: m.content?.trim()?.slice(0, 140) || (m.attachment_url ? "📎 Lampiran" : "Pesan baru"),
            messageId: m.id,
        });
    }

    let reminded = 0;
    for (const g of groups.values()) {
        try {
            const res = await notify({
                event: "CHAT_REMINDER",
                recipientUserId: g.recipientId,
                conversationId: g.conversationId,
                senderName: g.senderName,
                preview: g.preview,
                messageId: g.messageId,
            });
            if (!res.duplicate) reminded++;
        } catch (error) {
            logger.error("chat_reminder:failed", { conversationId: g.conversationId, error: String(error) });
        }
    }

    return { inspected: unread.length, reminded };
}
