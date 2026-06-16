"use client";

import { Zap } from "lucide-react";
import { SellerNavLinks, usePendingOrdersCount } from "./SellerNavLinks";

/** Desktop seller sidebar (lg+). The mobile/tablet equivalent is SellerMobileNav. */
export function SellerSidebar() {
    const pendingOrdersCount = usePendingOrdersCount();

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
                <SellerNavLinks pendingOrdersCount={pendingOrdersCount} />
            </div>
        </aside>
    );
}
