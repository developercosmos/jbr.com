import { getConversations } from "@/actions/chat";
import { ChatClient } from "../chat/ChatClient";

interface MessagesPageProps {
    searchParams: Promise<{ c?: string }>;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
    const conversations = await getConversations();
    const params = await searchParams;
    // Use short param 'c' instead of full 'conversation' to reduce WAF triggers
    const initialConversationId = params.c || null;

    return (
        <ChatClient
            initialConversations={conversations}
            initialConversationId={initialConversationId}
        />
    );
}
