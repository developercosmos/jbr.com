"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useHeaderCounters } from "@/hooks/useHeaderCounters";

export function ChatBadge() {
    const { data: session } = useSession();
    const { unreadChatCount } = useHeaderCounters(Boolean(session?.user));

    return (
        <Link href="/messages">
            <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all group">
                <MessageCircle className="w-5 h-5" />
                {session?.user && unreadChatCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-brand-primary text-[9px] font-bold text-white rounded-full border border-white">
                        {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                ) : (
                    <span className="absolute top-1.5 right-1.5 size-1.5 bg-brand-primary rounded-full border border-white scale-0 group-hover:scale-100 transition-transform duration-200"></span>
                )}
            </button>
        </Link>
    );
}
