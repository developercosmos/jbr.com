import { getConversations } from "@/actions/chat";
import { ChatClient } from "../chat/ChatClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface MessagesPageProps {
    searchParams: Promise<{ c?: string }>;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
    // Check authentication
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login?callbackUrl=/messages");
    }

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
