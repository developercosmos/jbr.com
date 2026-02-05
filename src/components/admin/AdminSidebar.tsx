"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldCheck, Package, Users, BarChart3, LifeBuoy, Gavel, ShoppingBag, FolderOpen, Settings, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminSidebarProps {
    pendingModerationCount?: number;
}

const getNavItems = (pendingCount: number) => [
    {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
    },
    {
        label: "Moderation",
        href: "/admin/moderation",
        icon: ShieldCheck,
        badge: pendingCount > 0 ? pendingCount : undefined,
    },
    {
        label: "Users",
        href: "/admin/users",
        icon: Users,
    },
    {
        label: "Categories",
        href: "/admin/categories",
        icon: FolderOpen,
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
        label: "File Manager",
        href: "/admin/files",
        icon: FileImage,
    },
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
    {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
    },
];

export function AdminSidebar({ pendingModerationCount = 0 }: AdminSidebarProps) {
    const pathname = usePathname();
    const navItems = getNavItems(pendingModerationCount);

    return (
        <aside className="hidden w-72 flex-col bg-white border-r border-slate-200 lg:flex z-10 shadow-sm h-[calc(100vh-65px)] sticky top-[65px]">
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
                                    <span className="ml-auto flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-brand-primary text-[10px] font-bold text-white">
                                        {item.badge > 99 ? "99+" : item.badge}
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
