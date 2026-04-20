"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useHeaderCounters } from "@/hooks/useHeaderCounters";

export function CartBadge() {
    const { data: session } = useSession();
    const { cartCount } = useHeaderCounters();

    return (
        <Link href="/cart">
            <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all">
                <ShoppingCart className="w-5 h-5" />
                {session?.user && cartCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-brand-primary text-[9px] font-bold text-white rounded-full border border-white">
                        {cartCount > 99 ? "99+" : cartCount}
                    </span>
                )}
            </button>
        </Link>
    );
}
