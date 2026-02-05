"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, UserCheck, MessageCircle } from "lucide-react";
import { toggleFollow } from "@/actions/store";
import { startConversation } from "@/actions/chat";

interface StoreActionButtonsProps {
    sellerId: string;
    initialIsFollowing: boolean;
    isOwnStore: boolean;
}

export function StoreActionButtons({
    sellerId,
    initialIsFollowing,
    isOwnStore,
}: StoreActionButtonsProps) {
    const router = useRouter();
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [isPending, startTransition] = useTransition();
    const [isChatLoading, setIsChatLoading] = useState(false);

    const handleFollow = () => {
        startTransition(async () => {
            const result = await toggleFollow(sellerId);
            if (result.success) {
                setIsFollowing(result.isFollowing ?? false);
            }
        });
    };

    const handleChat = async () => {
        setIsChatLoading(true);
        try {
            const result = await startConversation(sellerId);
            if (result.error === "unauthorized") {
                router.push("/auth/login?redirect=/messages");
                return;
            }
            if (result.conversationId) {
                // Use /messages with short param 'c' to bypass Cloudflare WAF
                router.push(`/messages?c=${result.conversationId}`);
            }
        } catch (error) {
            console.error("Failed to start chat:", error);
        } finally {
            setIsChatLoading(false);
        }
    };

    // Don't show buttons for own store
    if (isOwnStore) {
        return null;
    }

    return (
        <div className="flex gap-3">
            <button
                onClick={handleFollow}
                disabled={isPending}
                className={`px-6 py-2.5 font-semibold rounded-lg transition-colors flex items-center gap-2 ${isFollowing
                    ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    : "bg-brand-primary text-white hover:bg-brand-primary/90"
                    }`}
            >
                {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : isFollowing ? (
                    <UserCheck className="w-4 h-4" />
                ) : (
                    <UserPlus className="w-4 h-4" />
                )}
                {isFollowing ? "Following" : "Follow"}
            </button>
            <button
                onClick={handleChat}
                disabled={isChatLoading}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
                {isChatLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <MessageCircle className="w-4 h-4" />
                )}
                Chat
            </button>
        </div>
    );
}
