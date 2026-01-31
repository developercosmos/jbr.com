"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getUnreadCount } from "@/actions/chat";
import { useSession } from "@/lib/auth-client";

export function ChatBadge() {
    const { data: session } = useSession();
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!session?.user) {
            setUnreadCount(0);
            return;
        }

        let isPolling = true;
        let timeoutId: NodeJS.Timeout;

        const pollUnread = async () => {
            if (!isPolling || document.hidden) {
                timeoutId = setTimeout(pollUnread, 10000);
                return;
            }

            try {
                const count = await getUnreadCount();
                setUnreadCount(count);
            } catch (error) {
                // Silent fail for unread count
            }

            if (isPolling) {
                timeoutId = setTimeout(pollUnread, 10000); // Poll every 10 seconds
            }
        };

        // Initial fetch
        pollUnread();

        return () => {
            isPolling = false;
            clearTimeout(timeoutId);
        };
    }, [session?.user]);

    return (
        <Link href="/chat">
            <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all group">
                <MessageCircle className="w-5 h-5" />
                {unreadCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-brand-primary text-[9px] font-bold text-white rounded-full border border-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                ) : (
                    <span className="absolute top-1.5 right-1.5 size-1.5 bg-brand-primary rounded-full border border-white scale-0 group-hover:scale-100 transition-transform duration-200"></span>
                )}
            </button>
        </Link>
    );
}
