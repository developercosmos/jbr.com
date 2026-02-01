"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Filter, ChevronDown, ChevronUp } from "lucide-react";

interface Category {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
}

interface FilterOption {
    value: string;
    label: string;
}

interface SearchFiltersPanelProps {
    categories: Category[];
    conditions: FilterOption[];
    genders: FilterOption[];
    priceRange: { min: number; max: number };
    currentFilters: {
        q?: string;
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        condition?: string;
        gender?: string;
    };
}

export function SearchFiltersPanel({
    categories,
    conditions,
    genders,
    priceRange,
    currentFilters,
}: SearchFiltersPanelProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [openSections, setOpenSections] = useState({
        category: true,
        price: true,
        condition: true,
        gender: true,
    });

    const [minPrice, setMinPrice] = useState(currentFilters.minPrice || "");
    const [maxPrice, setMaxPrice] = useState(currentFilters.maxPrice || "");

    const toggleSection = (section: keyof typeof openSections) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    const applyFilter = (key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.delete("page"); // Reset to page 1
        router.push(`/search?${params.toString()}`);
    };

    const applyPriceFilter = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (minPrice) {
            params.set("minPrice", minPrice);
        } else {
            params.delete("minPrice");
        }
        if (maxPrice) {
            params.set("maxPrice", maxPrice);
        } else {
            params.delete("maxPrice");
        }
        params.delete("page");
        router.push(`/search?${params.toString()}`);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID").format(value);
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-600" />
                <h2 className="font-bold text-slate-900">Filter</h2>
            </div>

            {/* Category Filter */}
            <div className="border-b border-slate-100">
                <button
                    onClick={() => toggleSection("category")}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <span className="font-medium text-slate-700">Kategori</span>
                    {openSections.category ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </button>
                {openSections.category && (
                    <div className="px-4 pb-4 space-y-2">
                        <button
                            onClick={() => applyFilter("category", null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!currentFilters.category
                                    ? "bg-brand-primary text-white"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                        >
                            Semua Kategori
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => applyFilter("category", cat.slug)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentFilters.category === cat.slug
                                        ? "bg-brand-primary text-white"
                                        : "hover:bg-slate-100 text-slate-700"
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Price Filter */}
            <div className="border-b border-slate-100">
                <button
                    onClick={() => toggleSection("price")}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <span className="font-medium text-slate-700">Harga</span>
                    {openSections.price ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </button>
                {openSections.price && (
                    <div className="px-4 pb-4">
                        <p className="text-xs text-slate-500 mb-2">
                            Range: Rp {formatCurrency(priceRange.min)} - Rp {formatCurrency(priceRange.max)}
                        </p>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="number"
                                placeholder="Min"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="number"
                                placeholder="Max"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                            />
                        </div>
                        <button
                            onClick={applyPriceFilter}
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            Terapkan
                        </button>
                    </div>
                )}
            </div>

            {/* Condition Filter */}
            <div className="border-b border-slate-100">
                <button
                    onClick={() => toggleSection("condition")}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <span className="font-medium text-slate-700">Kondisi</span>
                    {openSections.condition ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </button>
                {openSections.condition && (
                    <div className="px-4 pb-4 space-y-2">
                        <button
                            onClick={() => applyFilter("condition", null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!currentFilters.condition
                                    ? "bg-brand-primary text-white"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                        >
                            Semua
                        </button>
                        {conditions.map((cond) => (
                            <button
                                key={cond.value}
                                onClick={() => applyFilter("condition", cond.value)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentFilters.condition === cond.value
                                        ? "bg-brand-primary text-white"
                                        : "hover:bg-slate-100 text-slate-700"
                                    }`}
                            >
                                {cond.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Gender Filter */}
            <div>
                <button
                    onClick={() => toggleSection("gender")}
                    className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                    <span className="font-medium text-slate-700">Gender</span>
                    {openSections.gender ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                </button>
                {openSections.gender && (
                    <div className="px-4 pb-4 space-y-2">
                        <button
                            onClick={() => applyFilter("gender", null)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${!currentFilters.gender
                                    ? "bg-brand-primary text-white"
                                    : "hover:bg-slate-100 text-slate-700"
                                }`}
                        >
                            Semua
                        </button>
                        {genders.map((g) => (
                            <button
                                key={g.value}
                                onClick={() => applyFilter("gender", g.value)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentFilters.gender === g.value
                                        ? "bg-brand-primary text-white"
                                        : "hover:bg-slate-100 text-slate-700"
                                    }`}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
