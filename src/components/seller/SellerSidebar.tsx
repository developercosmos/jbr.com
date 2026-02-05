"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackagePlus, ShoppingBag, BarChart3, Zap, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    badge?: number;
}

const baseNavItems: NavItem[] = [
    {
        label: "Overview",
        href: "/seller",
        icon: LayoutDashboard,
    },
    {
        label: "Add Product",
        href: "/seller/products/add",
        icon: PackagePlus,
    },
    {
        label: "Orders",
        href: "/seller/orders",
        icon: ShoppingBag,
        // Badge will be fetched dynamically
    },
    {
        label: "Analytics",
        href: "/seller/analytics",
        icon: BarChart3,
    },
    {
        label: "Store Settings",
        href: "/seller/settings",
        icon: Store,
    },
];

export function SellerSidebar() {
    const pathname = usePathname();
    const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

    // Fetch pending orders count
    useEffect(() => {
        async function fetchPendingOrders() {
            try {
                const res = await fetch("/api/seller/pending-orders-count");
                if (res.ok) {
                    const data = await res.json();
                    setPendingOrdersCount(data.count || 0);
                }
            } catch (error) {
                console.error("Failed to fetch pending orders count:", error);
            }
        }
        fetchPendingOrders();
    }, []);

    // Build nav items with dynamic badge
    const navItems = baseNavItems.map((item) => {
        if (item.href === "/seller/orders" && pendingOrdersCount > 0) {
            return { ...item, badge: pendingOrdersCount };
        }
        return item;
    });

    return (
        <aside className="hidden w-72 flex-col bg-white border-r border-slate-200 lg:flex z-10 shadow-sm h-[calc(100vh-65px)] sticky top-[65px]">
            <div className="flex h-20 items-center gap-3 px-8 border-b border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
                    <Zap className="w-5 h-5 fill-current" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase font-heading">
                    Seller Center
                </h1>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 gap-8">
                <div className="flex flex-col gap-1.5">
                    <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 font-heading">
                        Management
                    </p>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                                    isActive
                                        ? "bg-orange-50 text-orange-600 shadow-sm ring-1 ring-orange-100"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-orange-600"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                                {item.label}
                                {item.badge && item.badge > 0 && (
                                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                                        {item.badge > 9 ? "9+" : item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>


            </div>
        </aside>
    );
}
