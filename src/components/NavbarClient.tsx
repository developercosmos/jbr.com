"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, LogIn, User } from "lucide-react";
import { useSession } from "@/lib/auth-client";

export function NavbarUserArea() {
    const { data: session, isPending } = useSession();

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

    return (
        <Link href="/profile">
            <div className="relative flex items-center gap-2 cursor-pointer group p-1 pr-2 rounded-full hover:bg-slate-50 transition-colors">
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
                <ChevronDown className="hidden md:block w-3 h-3 text-slate-400 group-hover:text-brand-primary transition-colors" />
            </div>
        </Link>
    );
}
