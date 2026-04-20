"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SortOption {
    value: string;
    label: string;
}

interface SearchSortControlProps {
    sortOptions: SortOption[];
    currentSort: string;
}

export function SearchSortControl({ sortOptions, currentSort }: SearchSortControlProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleSortChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", value);
        params.delete("page");
        router.push(`/search?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Urutkan:</span>
            <select
                value={currentSort}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary"
                onChange={(e) => handleSortChange(e.target.value)}
            >
                {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
