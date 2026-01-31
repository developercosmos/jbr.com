"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCartCount } from "@/actions/cart";
import { useSession } from "@/lib/auth-client";

export function CartBadge() {
    const { data: session } = useSession();
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!session?.user) {
            setCount(0);
            return;
        }

        let isPolling = true;
        let timeoutId: NodeJS.Timeout;

        const pollCount = async () => {
            if (!isPolling || document.hidden) {
                timeoutId = setTimeout(pollCount, 15000);
                return;
            }

            try {
                const cartCount = await getCartCount();
                setCount(cartCount);
            } catch {
                // Silent fail
            }

            if (isPolling) {
                timeoutId = setTimeout(pollCount, 15000); // Poll every 15 seconds
            }
        };

        // Initial fetch
        pollCount();

        return () => {
            isPolling = false;
            clearTimeout(timeoutId);
        };
    }, [session?.user]);

    return (
        <Link href="/cart">
            <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all">
                <ShoppingCart className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-brand-primary text-[9px] font-bold text-white rounded-full border border-white">
                        {count > 99 ? "99+" : count}
                    </span>
                )}
            </button>
        </Link>
    );
}
