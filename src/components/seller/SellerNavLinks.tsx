"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SELLER_NAV_ITEMS } from "./seller-nav-items";

interface SellerNavLinksProps {
    pendingOrdersCount?: number;
    /** Called when a link is tapped — used by the mobile drawer to close itself. */
    onNavigate?: () => void;
}

/** Shared "Management" nav list with active-state + the orders badge. */
export function SellerNavLinks({ pendingOrdersCount = 0, onNavigate }: SellerNavLinksProps) {
    const pathname = usePathname();

    return (
        <div className="flex flex-col gap-1.5">
            <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 font-heading">
                Management
            </p>
            {SELLER_NAV_ITEMS.map((item) => {
                const isActive =
                    item.href === "/seller"
                        ? pathname === "/seller"
                        : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const badge =
                    item.href === "/seller/orders" && pendingOrdersCount > 0 ? pendingOrdersCount : undefined;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                            isActive
                                ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-100"
                                : "text-slate-500 hover:bg-slate-50 hover:text-orange-600"
                        )}
                    >
                        <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                        {item.label}
                        {badge && (
                            <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                                {badge > 9 ? "9+" : badge}
                            </span>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}

/** Client hook: pending orders count for the seller (drives the Orders badge). */
export function usePendingOrdersCount(): number {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await fetch("/api/seller/pending-orders-count");
                if (res.ok && alive) {
                    const data = await res.json();
                    setCount(data.count || 0);
                }
            } catch {
                /* non-fatal: badge just stays at 0 */
            }
        })();
        return () => {
            alive = false;
        };
    }, []);
    return count;
}
