import { getConversations } from "@/actions/chat";
import { ChatClient } from "./ChatClient";

interface ChatPageProps {
    searchParams: Promise<{ conversation?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
    const conversations = await getConversations();
    const params = await searchParams;
    const initialConversationId = params.conversation || null;

    return (
        <ChatClient
            initialConversations={conversations}
            initialConversationId={initialConversationId}
        />
    );
}
