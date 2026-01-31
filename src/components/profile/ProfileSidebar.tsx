"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, MapPin, Package2, Heart, Settings, Verified } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    {
        label: "Profil Saya",
        href: "/profile",
        icon: User,
    },
    {
        label: "Daftar Alamat",
        href: "/profile/address",
        icon: MapPin,
    },
    {
        label: "Pesanan Saya",
        href: "/profile/orders",
        icon: Package2,
    },
    {
        label: "Wishlist",
        href: "/profile/wishlist",
        icon: Heart,
    },
    {
        label: "Pengaturan Akun",
        href: "/profile/settings",
        icon: Settings,
    },
];

export function ProfileSidebar() {
    const pathname = usePathname();

    return (
        <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200 p-6 sticky top-[65px] h-[calc(100vh-65px)]">
            <div className="flex flex-col gap-6">
                {/* User Info */}
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div
                        className="bg-center bg-no-repeat bg-cover rounded-full size-12 border border-slate-100 shadow-sm"
                        style={{
                            backgroundImage:
                                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCef0deJkCcubfo3cuAeO3KI-TuJJoMo35rb8_hlxiopb2pprzliSvN2FbWKjhXDfFte9MX8ZGQDIZJ2D4i2p3uWxhZDyBwwmh5esX5zwq9hgUCsRZvdJbtKwYFmOS1kGMQfHCvy5JmD0ljy2Dycj8mJmnmQ2thc9OTwC-p8XvHNpTC7C4XMgdOQbaAr3oIF_nlWnqO9eg0sqcvxOrEv2x93YhplxG6QVWaDJp48PJIKVWAKiQoaIqe-tDLFMdEwjxFY2pcSU03tV4')",
                        }}
                    ></div>
                    <div className="flex flex-col">
                        <h1 className="text-slate-900 text-base font-bold leading-normal font-heading">
                            Budi Santoso
                        </h1>
                        <div className="flex items-center gap-1">
                            <Verified className="w-3.5 h-3.5 text-brand-primary fill-current" />
                            <p className="text-slate-500 text-xs font-normal leading-normal">
                                Member Silver
                            </p>
                        </div>
                    </div>
                </div>
                {/* Navigation */}
                <nav className="flex flex-col gap-1.5">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                                    isActive
                                        ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-brand-primary"
                                )}
                            >
                                <item.icon
                                    className={cn(
                                        "w-5 h-5 transition-transform",
                                        !isActive && "group-hover:scale-110"
                                    )}
                                />
                                <p
                                    className={cn(
                                        "text-sm leading-normal",
                                        isActive ? "font-bold" : "font-medium"
                                    )}
                                >
                                    {item.label}
                                </p>
                            </Link>
                        );
                    })}
                </nav>
            </div>
        </aside>
    );
}
