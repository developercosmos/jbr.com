"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, X } from "lucide-react";

interface TicketFiltersProps {
    currentSearch?: string;
    currentStatus?: string;
    currentCategory?: string;
}

export function TicketFilters({ currentSearch, currentStatus, currentCategory }: TicketFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();
    const [searchValue, setSearchValue] = useState(currentSearch || "");

    const updateFilters = useCallback(
        (updates: Record<string, string | undefined>) => {
            const params = new URLSearchParams(searchParams.toString());
            Object.entries(updates).forEach(([key, value]) => {
                if (value && value !== "all") {
                    params.set(key, value);
                } else {
                    params.delete(key);
                }
            });
            startTransition(() => {
                router.push(`/admin/support?${params.toString()}`);
            });
        },
        [router, searchParams]
    );

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters({ search: searchValue || undefined });
    };

    const clearFilters = () => {
        setSearchValue("");
        router.push("/admin/support");
    };

    const hasFilters = currentSearch || currentStatus || currentCategory;

    return (
        <div className="flex flex-col md:flex-row gap-4 mb-6">
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => setSearchValue(e.target.value)}
                        placeholder="Cari subjek, nomor tiket... (mendukung: Li-Ning, LiNing, Li Ning)"
                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all"
                    />
                </div>
            </form>

            {/* Status Filter */}
            <select
                value={currentStatus || "all"}
                onChange={(e) => updateFilters({ status: e.target.value })}
                className="px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
                <option value="all">Semua Status</option>
                <option value="OPEN">Open</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="CLOSED">Closed</option>
            </select>

            {/* Category Filter */}
            <select
                value={currentCategory || "all"}
                onChange={(e) => updateFilters({ category: e.target.value })}
                className="px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            >
                <option value="all">Semua Kategori</option>
                <option value="ACCOUNT">Account</option>
                <option value="PAYMENT">Payment</option>
                <option value="SHIPPING">Shipping</option>
                <option value="VERIFICATION">Verification</option>
                <option value="SECURITY">Security</option>
                <option value="TECHNICAL">Technical</option>
                <option value="OTHER">Other</option>
            </select>

            {/* Clear Filters */}
            {hasFilters && (
                <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:text-brand-primary transition-colors"
                >
                    <X className="w-4 h-4" />
                    Reset
                </button>
            )}

            {isPending && (
                <div className="flex items-center justify-center px-4">
                    <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin" />
                </div>
            )}
        </div>
    );
}
