import { getConversations } from "@/actions/chat";
import { ChatClient } from "./ChatClient";

interface ChatPageProps {
    searchParams: Promise<{ conversation?: string; c?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
    const conversations = await getConversations();
    const params = await searchParams;
    const initialConversationId = params.c || params.conversation || null;

    return (
        <ChatClient
            initialConversations={conversations}
            initialConversationId={initialConversationId}
        />
    );
}
