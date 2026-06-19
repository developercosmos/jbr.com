"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal, Eye, Truck, Copy, Check } from "lucide-react";

type Props = {
    orderId: string;
    orderNumber: string;
    status: string;
};

/** Per-row action menu for the seller Orders table. */
export function OrderRowActions({ orderId, orderNumber, status }: Props) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, []);

    const needsAction = status === "PAID" || status === "PROCESSING";

    async function copyNumber() {
        try {
            await navigator.clipboard.writeText(orderNumber);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard unavailable — non-fatal */
        }
    }

    return (
        <div className="relative inline-block text-left" ref={ref}>
            <button
                onClick={() => setOpen((o) => !o)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                aria-haspopup="menu"
                aria-expanded={open}
                title="Aksi"
            >
                <MoreHorizontal className="w-4 h-4" />
            </button>
            {open && (
                <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 w-52 origin-top-right rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark shadow-lg py-1 text-sm"
                >
                    <Link
                        href={`/seller/orders/${orderId}`}
                        className="flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                        role="menuitem"
                    >
                        <Eye className="w-4 h-4 text-slate-400" />
                        Lihat Detail
                    </Link>
                    {needsAction && (
                        <Link
                            href={`/seller/orders/${orderId}`}
                            className="flex items-center gap-2 px-3 py-2 text-brand-primary font-medium hover:bg-brand-primary/5"
                            role="menuitem"
                        >
                            <Truck className="w-4 h-4" />
                            Proses Pengiriman
                        </Link>
                    )}
                    <button
                        onClick={copyNumber}
                        className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                        role="menuitem"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        {copied ? "Tersalin!" : "Salin No. Pesanan"}
                    </button>
                </div>
            )}
        </div>
    );
}
