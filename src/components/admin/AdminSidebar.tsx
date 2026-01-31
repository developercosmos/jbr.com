"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldCheck, Package, Users, BarChart3, LifeBuoy, LogOut, Gavel, ShoppingBag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        label: "Moderation",
        href: "/admin/moderation",
        icon: ShieldCheck,
        badge: 12,
    },
    {
        label: "Users",
        href: "/admin/users",
        icon: Users,
    },
    {
        label: "Products",
        href: "/admin/products",
        icon: Package,
    },
    {
        label: "Orders",
        href: "/admin/orders",
        icon: ShoppingBag,
    },
    {
        label: "Disputes",
        href: "/admin/disputes",
        icon: Gavel,
    },
];

const toolItems = [
    {
        label: "Analytics",
        href: "/admin/analytics",
        icon: BarChart3,
    },
    {
        label: "Support",
        href: "/admin/support",
        icon: LifeBuoy,
    },
];

export function AdminSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden w-72 flex-col bg-white border-r border-slate-200 lg:flex z-10 shadow-sm h-[calc(100vh-65px)] sticky top-[65px]">
            <div className="flex h-20 items-center gap-3 px-8 border-b border-slate-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary text-white shadow-sm">
                    <Zap className="w-5 h-5 fill-current" />
                </div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900 uppercase font-heading">
                    JUALBELIRAKET
                </h1>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 gap-8">
                <div className="flex flex-col gap-1.5">
                    <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 font-heading">
                        Overview
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
                                        ? "bg-slate-50 text-brand-primary shadow-sm ring-1 ring-slate-200"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-brand-primary"
                                )}
                            >
                                <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                                {item.label}
                                {item.badge && (
                                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white">
                                        {item.badge}
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                <div className="flex flex-col gap-1.5">
                    <p className="px-3 text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 font-heading">
                        Tools
                    </p>
                    {toolItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-brand-primary transition-all"
                        >
                            <item.icon className="w-5 h-5" />
                            {item.label}
                        </Link>
                    ))}
                </div>


            </div>
        </aside>
    );
}
