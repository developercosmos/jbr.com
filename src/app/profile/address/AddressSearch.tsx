"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";

export function AddressSearch({ initialSearch }: { initialSearch?: string }) {
    const router = useRouter();
    const [search, setSearch] = useState(initialSearch || "");

    const handleSearch = useCallback((value: string) => {
        setSearch(value);

        // Debounce search
        const timeout = setTimeout(() => {
            const params = new URLSearchParams();
            if (value.trim()) {
                params.set("search", value);
            }
            router.push(`/profile/address?${params.toString()}`);
        }, 500);

        return () => clearTimeout(timeout);
    }, [router]);

    return (
        <div className="mb-6">
            <label className="flex flex-col w-full">
                <div className="flex w-full items-center rounded-lg h-12 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 focus-within:border-brand-primary transition-colors">
                    <div className="text-slate-400 flex items-center justify-center pl-4 pr-2">
                        <Search className="w-5 h-5" />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="flex w-full bg-transparent border-none text-slate-900 dark:text-white focus:ring-0 placeholder:text-slate-400 px-2 text-sm font-normal h-full outline-none"
                        placeholder="Cari alamat berdasarkan nama penerima, label, atau jalan..."
                    />
                </div>
            </label>
        </div>
    );
}
