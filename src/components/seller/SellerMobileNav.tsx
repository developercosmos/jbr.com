"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Zap } from "lucide-react";
import { SellerNavLinks, usePendingOrdersCount } from "./SellerNavLinks";

/**
 * Mobile + tablet (<lg) seller navigation: a sticky bar with a hamburger that
 * opens the seller menu as a slide-in drawer. Covers the gap where the desktop
 * SellerSidebar (hidden < lg) leaves small screens with no seller nav.
 */
export function SellerMobileNav() {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();
    const pendingOrdersCount = usePendingOrdersCount();

    // Auto-close on route change.
    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    // Lock body scroll + close on Escape while the drawer is open.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <>
            {/* Sticky bar — only on < lg, sits right under the global navbar. */}
            <div className="lg:hidden sticky top-16 z-30 flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-2.5 shadow-sm">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label="Buka menu seller"
                    aria-expanded={open}
                    className="flex items-center justify-center h-9 w-9 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-orange-600 transition-colors"
                >
                    <Menu className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500 text-white">
                        <Zap className="w-4 h-4 fill-current" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-slate-900 uppercase font-heading">
                        Seller Center
                    </span>
                </div>
            </div>

            {/* Drawer */}
            {open && (
                <div className="lg:hidden fixed inset-0 z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                    {/* Panel */}
                    <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl flex flex-col">
                        <div className="flex h-16 items-center justify-between gap-3 px-5 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500 text-white shadow-sm">
                                    <Zap className="w-5 h-5 fill-current" />
                                </div>
                                <h2 className="text-base font-bold tracking-tight text-slate-900 uppercase font-heading">
                                    Seller Center
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Tutup menu"
                                className="flex items-center justify-center h-9 w-9 rounded-lg text-slate-500 hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 py-5">
                            <SellerNavLinks
                                pendingOrdersCount={pendingOrdersCount}
                                onNavigate={() => setOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
