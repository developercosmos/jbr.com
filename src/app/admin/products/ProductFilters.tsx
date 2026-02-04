"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Search, Filter, X } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
}

interface ProductFiltersProps {
    categories: Category[];
}

export function ProductFilters({ categories }: ProductFiltersProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    const currentStatus = searchParams.get("status") || "all";
    const currentCategory = searchParams.get("category") || "";

    const updateFilters = useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(searchParams.toString());

            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === "" || value === "all") {
                    params.delete(key);
                } else {
                    params.set(key, value);
                }
            });

            startTransition(() => {
                router.push(`/admin/products?${params.toString()}`);
            });
        },
        [router, searchParams]
    );

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateFilters({ search: search || null });
    };

    const handleClearSearch = () => {
        setSearch("");
        updateFilters({ search: null });
    };

    const selectedCategory = categories.find(c => c.id === currentCategory);

    return (
        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-primary transition-colors">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search product name, SKU, or seller..."
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all"
                />
                {search && (
                    <button
                        type="button"
                        onClick={handleClearSearch}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </form>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                {/* Category Filter */}
                <div className="relative">
                    <button
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap"
                    >
                        <Filter className="w-4 h-4" />
                        {selectedCategory ? selectedCategory.name : "Filter Category"}
                    </button>

                    {showCategoryDropdown && (
                        <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-10 py-2 max-h-64 overflow-y-auto">
                            <button
                                onClick={() => {
                                    updateFilters({ category: null });
                                    setShowCategoryDropdown(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 ${!currentCategory ? "text-brand-primary font-medium" : "text-slate-600 dark:text-slate-300"}`}
                            >
                                All Categories
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => {
                                        updateFilters({ category: cat.id });
                                        setShowCategoryDropdown(false);
                                    }}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/5 ${currentCategory === cat.id ? "text-brand-primary font-medium" : "text-slate-600 dark:text-slate-300"}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Status Filter */}
                <select
                    value={currentStatus}
                    onChange={(e) => updateFilters({ status: e.target.value })}
                    className="px-4 py-2.5 pr-8 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary text-sm font-medium cursor-pointer appearance-none"
                    disabled={isPending}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="review">Needs Review</option>
                    <option value="moderated">Moderated</option>
                    <option value="archived">Archived</option>
                </select>
            </div>
        </div>
    );
}
