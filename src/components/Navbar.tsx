"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Tag, Menu, X } from "lucide-react";
import { NavbarUserArea } from "./NavbarClient";
import { ChatBadge } from "./ChatBadge";
import { CartBadge } from "./CartBadge";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";
import { useSession } from "@/lib/auth-client";
import { useFlag } from "@/lib/use-flag";

const NAV_LINKS: { href: string; label: string; flag?: string }[] = [
    { href: "/feed", label: "Feed" },
    { href: "/men", label: "Men" },
    { href: "/women", label: "Women" },
    { href: "/equipment", label: "Equipment" },
    { href: "/brands", label: "Brands" },
    // Compare is racket-only — gated behind dif.compare_mode (hidden while off).
    { href: "/compare", label: "Compare", flag: "dif.compare_mode" },
    { href: "/affiliate", label: "Affiliate" },
];

export function Navbar() {
    const { data: session, isPending } = useSession();
    const isAuthenticated = Boolean(session?.user);
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const compareEnabled = useFlag("dif.compare_mode");
    // Drop any flag-gated links whose flag is off.
    const navLinks = NAV_LINKS.filter((l) => !l.flag || (l.flag === "dif.compare_mode" && compareEnabled));

    // Close the drawer on navigation.
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Lock scroll + close on Escape while the drawer is open.
    useEffect(() => {
        if (!mobileOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [mobileOpen]);

    return (
        <nav className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-6">
                    {/* Logo Section */}
                    <Link href="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity" aria-label="JualBeliRaket.com — Beranda">
                        <Image
                            src="/brand/jr.png"
                            alt="JualBeliRaket"
                            width={438}
                            height={200}
                            priority
                            className="h-9 w-auto"
                        />
                        <Image
                            src="/brand/jualbeliraket.png"
                            alt="JualBeliRaket.com"
                            width={697}
                            height={128}
                            priority
                            className="h-6 w-auto"
                        />
                    </Link>

                    {/* Search Bar Section (Dominant) */}
                    <div className="hidden md:block flex-1 max-w-xl mx-auto">
                        <SearchBar />
                    </div>

                    {/* User Actions Section */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Icons Group */}
                        <div className="flex items-center gap-1 sm:gap-1 border-r border-slate-200 pr-3 mr-1">
                            {/* Chat */}
                            <ChatBadge isAuthenticated={isAuthenticated} />
                            {/* Notifications */}
                            <NotificationBell isAuthenticated={isAuthenticated} />
                            {/* Cart */}
                            <CartBadge isAuthenticated={isAuthenticated} />
                        </div>

                        {/* User Profile */}
                        <NavbarUserArea
                            user={session?.user
                                ? {
                                    name: session.user.name,
                                    email: session.user.email,
                                    image: session.user.image,
                                    // Server-side `user.additionalFields` exposes role on the
                                    // session payload; the client typing doesn't see it without
                                    // the `inferAdditionalFields` plugin (which we removed
                                    // because it caused render-loop instability — see auth-client.ts).
                                    // Cast narrowly here.
                                    role: (session.user as { role?: string | null }).role ?? null,
                                }
                                : undefined}
                            isPending={isPending}
                        />

                        {/* Mobile Menu Button */}
                        <button
                            type="button"
                            onClick={() => setMobileOpen((o) => !o)}
                            aria-label={mobileOpen ? "Tutup menu" : "Buka menu"}
                            aria-expanded={mobileOpen}
                            className="md:hidden p-2 text-slate-500 hover:text-brand-primary"
                        >
                            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Secondary Navigation */}
                <div className="hidden md:flex items-center gap-6 h-10 text-xs font-medium text-slate-500 border-t border-slate-100">
                    <Link href="/feed" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Feed
                    </Link>
                    <Link href="/men" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Men
                    </Link>
                    <Link href="/women" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Women
                    </Link>
                    <Link href="/equipment" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Equipment
                    </Link>
                    <Link href="/brands" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Brands
                    </Link>
                    {compareEnabled && (
                        <Link href="/compare" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                            Compare
                        </Link>
                    )}
                    <Link href="/affiliate" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Affiliate
                    </Link>
                    <Link
                        href="/seller/products/add"
                        className="text-orange-600 hover:text-orange-700 px-1 py-2.5 ml-auto flex items-center gap-1 transition-colors font-bold"
                    >
                        <Tag className="w-3.5 h-3.5" />
                        Sell Item
                    </Link>
                </div>
            </div>

            {/* Mobile drawer (the burger menu) */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 z-[60]">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setMobileOpen(false)}
                        aria-hidden="true"
                    />
                    <div className="absolute inset-y-0 right-0 w-72 max-w-[85%] bg-white shadow-xl flex flex-col">
                        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-100">
                            <span className="text-sm font-bold uppercase tracking-wide text-slate-900 font-heading">
                                Menu
                            </span>
                            <button
                                type="button"
                                onClick={() => setMobileOpen(false)}
                                aria-label="Tutup menu"
                                className="p-2 text-slate-500 hover:text-brand-primary"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-slate-100">
                            <SearchBar />
                        </div>
                        <nav className="flex flex-col p-2 overflow-y-auto">
                            {navLinks.map((l) => (
                                <Link
                                    key={l.href}
                                    href={l.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-brand-primary transition-colors"
                                >
                                    {l.label}
                                </Link>
                            ))}
                            <Link
                                href="/seller/products/add"
                                onClick={() => setMobileOpen(false)}
                                className="mt-1 px-3 py-3 rounded-lg text-sm font-bold text-orange-600 hover:bg-orange-50 flex items-center gap-2 transition-colors"
                            >
                                <Tag className="w-4 h-4" />
                                Sell Item
                            </Link>
                        </nav>
                    </div>
                </div>
            )}
        </nav>

    );
}
