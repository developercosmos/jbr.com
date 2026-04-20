import { getConversations } from "@/actions/chat";
import { ChatClient } from "../chat/ChatClient";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

interface MessagesPageProps {
    searchParams: Promise<{ c?: string; conversation?: string }>;
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
    // Prefer short param 'c' but keep legacy support for 'conversation'.
    const initialConversationId = params.c || params.conversation || null;

    return (
        <ChatClient
            initialConversations={conversations}
            initialConversationId={initialConversationId}
        />
    );
}
