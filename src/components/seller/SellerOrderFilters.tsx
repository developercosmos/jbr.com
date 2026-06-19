"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { DATE_RANGES } from "@/lib/seller-orders-query";

/** Search (debounced) + date-range filter for the seller Orders page. */
export function SellerOrderFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [q, setQ] = useState(searchParams.get("q") ?? "");
    const range = searchParams.get("range") ?? "all";
    const firstRun = useRef(true);

    function pushWith(overrides: Record<string, string | null>) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(overrides)) {
            if (value === null || value === "") params.delete(key);
            else params.set(key, value);
        }
        params.delete("page"); // any filter change resets to page 1
        const qs = params.toString();
        router.push(qs ? `/seller/orders?${qs}` : "/seller/orders");
    }

    // Keep the input in sync when the URL changes externally (e.g. tab switch).
    useEffect(() => {
        setQ(searchParams.get("q") ?? "");
    }, [searchParams]);

    // Debounced search push.
    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const handle = setTimeout(() => {
            if (q !== (searchParams.get("q") ?? "")) pushWith({ q: q || null });
        }, 400);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
            <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Cari ID Pesanan, Nama Pembeli..."
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
                <select
                    value={range}
                    onChange={(e) => pushWith({ range: e.target.value === "all" ? null : e.target.value })}
                    className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium cursor-pointer"
                >
                    {DATE_RANGES.map((r) => (
                        <option key={r.key} value={r.key}>
                            {r.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
