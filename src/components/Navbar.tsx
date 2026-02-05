"use client";

import Link from "next/link";
import { Zap, Tag, Menu } from "lucide-react";
import { NavbarUserArea } from "./NavbarClient";
import { ChatBadge } from "./ChatBadge";
import { CartBadge } from "./CartBadge";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 gap-6">
                    {/* Logo Section */}
                    <Link href="/" className="flex-shrink-0 flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity">
                        <div className="size-8 bg-brand-primary rounded-lg flex items-center justify-center shadow-sm">
                            <Zap className="text-white w-5 h-5 fill-current" />
                        </div>
                        <span className="text-brand-primary text-lg font-bold tracking-tight font-heading">JUALBELI RAKET.COM</span>
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
                            <ChatBadge />
                            {/* Notifications */}
                            <NotificationBell />
                            {/* Cart */}
                            <CartBadge />
                        </div>

                        {/* User Profile */}
                        <NavbarUserArea />

                        {/* Mobile Menu Button */}
                        <button className="md:hidden p-2 text-slate-500 hover:text-brand-primary">
                            <Menu className="w-6 h-6" />
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
                    <Link
                        href="/seller/products/add"
                        className="text-orange-600 hover:text-orange-700 px-1 py-2.5 ml-auto flex items-center gap-1 transition-colors font-bold"
                    >
                        <Tag className="w-3.5 h-3.5" />
                        Sell Item
                    </Link>
                </div>
            </div>
        </nav>

    );
}
