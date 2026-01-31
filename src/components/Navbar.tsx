"use client";

import Link from "next/link";
import { Search, ShoppingCart, MessageCircle, Bell, Zap, Tag, Menu } from "lucide-react";
import { NavbarUserArea } from "./NavbarClient";

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
                        <span className="text-brand-primary text-lg font-bold tracking-tight font-heading">JUALBELIRAKET.COM</span>
                    </Link>

                    {/* Search Bar Section (Dominant) */}
                    <div className="hidden md:block flex-1 max-w-xl mx-auto">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                            </div>
                            <input
                                className="block w-full pl-9 pr-20 py-2.5 border border-slate-200 rounded-full leading-5 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all"
                                placeholder="Search for gear..."
                                type="text"
                            />
                            {/* Integrated Search Filters/Action */}
                            <div className="absolute inset-y-0 right-0 flex items-center">
                                <select className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-slate-500 text-xs font-medium rounded-r-md focus:ring-0 focus:border-transparent cursor-pointer hover:text-brand-primary transition-colors border-l border-slate-200">
                                    <option>All</option>
                                    <option>New</option>
                                    <option>Pre-loved</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* User Actions Section */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Icons Group */}
                        <div className="flex items-center gap-1 sm:gap-1 border-r border-slate-200 pr-3 mr-1">
                            {/* Chat */}
                            <Link href="/chat">
                                <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all group">
                                    <MessageCircle className="w-5 h-5" />
                                    <span className="absolute top-1.5 right-1.5 size-1.5 bg-brand-primary rounded-full border border-white scale-0 group-hover:scale-100 transition-transform duration-200"></span>
                                </button>
                            </Link>
                            {/* Notifications */}
                            <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2 right-2.5 size-1.5 bg-orange-500 rounded-full border border-white"></span>
                            </button>
                            {/* Cart */}
                            <Link href="/cart">
                                <button className="relative p-2 rounded-full text-slate-500 hover:text-brand-primary hover:bg-slate-50 transition-all">
                                    <ShoppingCart className="w-5 h-5" />
                                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 bg-brand-primary text-[9px] font-bold text-white rounded-full border border-white">
                                        3
                                    </span>
                                </button>
                            </Link>
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
                    <Link href="#" className="text-brand-primary border-b-2 border-brand-primary px-1 py-2.5">
                        Feed
                    </Link>
                    <Link href="#" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Men
                    </Link>
                    <Link href="#" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Women
                    </Link>
                    <Link href="#" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
                        Equipment
                    </Link>
                    <Link href="#" className="hover:text-brand-primary hover:border-b-2 hover:border-slate-200 px-1 py-2.5 transition-all">
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
