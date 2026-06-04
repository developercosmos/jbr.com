import { getConversations } from "@/actions/chat";
import { ChatClient } from "./ChatClient";
import { FeatureFlagProvider } from "@/lib/use-flag";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface ChatPageProps {
    searchParams: Promise<{ conversation?: string; c?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
    const session = await auth.api.getSession({ headers: await headers() });
    const conversations = await getConversations();
    const params = await searchParams;
    const initialConversationId = params.c || params.conversation || null;

    // Resolve client-visible flags for the chat surface. (ChatClient uses useFlag,
    // which reads from this provider — previously absent, so its flags were dead.)
    const flagContext = { userId: session?.user?.id, bucketKey: session?.user?.id };
    const [smartQuestions, buyerReputationChat] = await Promise.all([
        isFeatureEnabled("dif.smart_questions", flagContext),
        isFeatureEnabled("pdp.buyer_reputation_chat", flagContext),
    ]);

    return (
        <FeatureFlagProvider
            flags={{
                "dif.smart_questions": smartQuestions,
                "pdp.buyer_reputation_chat": buyerReputationChat,
            }}
        >
            <ChatClient
                initialConversations={conversations}
                initialConversationId={initialConversationId}
            />
        </FeatureFlagProvider>
    );
}
