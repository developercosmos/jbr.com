"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LogIn, User, LogOut, Settings, Store, ShieldCheck } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function NavbarUserArea() {
    const { data: session, isPending } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await signOut();
        setIsOpen(false);
        router.push("/");
        router.refresh();
    };

    if (isPending) {
        return (
            <div className="relative flex items-center gap-2 p-1 pr-2 rounded-full">
                <div className="size-8 rounded-full bg-slate-200 animate-pulse" />
                <div className="hidden md:block w-16 h-3 bg-slate-200 rounded animate-pulse" />
            </div>
        );
    }

    if (!session?.user) {
        return (
            <Link href="/auth/login">
                <button className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-full hover:bg-blue-600 transition-colors">
                    <LogIn className="w-4 h-4" />
                    <span className="hidden sm:inline">Masuk</span>
                </button>
            </Link>
        );
    }

    const user = session.user;
    const isAdmin = (user as { role?: string }).role === "ADMIN";

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative flex items-center gap-2 cursor-pointer group p-1 pr-2 rounded-full hover:bg-slate-50 transition-colors"
            >
                <div className="size-8 rounded-full border border-slate-200 group-hover:border-brand-primary transition-colors overflow-hidden relative bg-slate-100">
                    {user.image ? (
                        <Image
                            alt={user.name || "User avatar"}
                            className="object-cover"
                            src={user.image}
                            fill
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User className="w-4 h-4" />
                        </div>
                    )}
                </div>
                <div className="hidden md:flex flex-col items-start">
                    <span className="text-xs font-bold text-slate-900 leading-none group-hover:text-brand-primary transition-colors">
                        {user.name?.split(" ")[0] || "User"}
                    </span>
                </div>
                <ChevronDown className={`hidden md:block w-3 h-3 text-slate-400 group-hover:text-brand-primary transition-all ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-slate-100">
                        <p className="font-bold text-slate-900 text-sm truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                        <Link
                            href="/profile"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-primary transition-colors"
                        >
                            <User className="w-4 h-4" />
                            Profil Saya
                        </Link>
                        <Link
                            href="/seller"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-primary transition-colors"
                        >
                            <Store className="w-4 h-4" />
                            Dashboard Penjual
                        </Link>
                        {isAdmin && (
                            <Link
                                href="/admin"
                                onClick={() => setIsOpen(false)}
                                className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-primary transition-colors"
                            >
                                <ShieldCheck className="w-4 h-4" />
                                Admin Panel
                            </Link>
                        )}
                        <Link
                            href="/profile/settings"
                            onClick={() => setIsOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-brand-primary transition-colors"
                        >
                            <Settings className="w-4 h-4" />
                            Pengaturan
                        </Link>
                    </div>

                    {/* Logout */}
                    <div className="border-t border-slate-100 pt-1">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Keluar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
