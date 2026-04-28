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
        weightClass?: string;
        balance?: string;
        shaftFlex?: string;
        gripSize?: string;
    };
    /**
     * SRCH-04: facet counts from Meilisearch query response. Shape:
     *   { weightClass: { "4U": 12, "3U": 5 }, balance: { ... }, ... }
     * When null (Postgres backend or no facets returned) the UI falls back
     * to showing options without count suffixes.
     */
    facetCounts?: Record<string, Record<string, number>> | null;
}

const WEIGHT_OPTIONS: FilterOption[] = [
    { value: "2U", label: "2U (~90g)" },
    { value: "3U", label: "3U (85-89g)" },
    { value: "4U", label: "4U (80-84g)" },
    { value: "5U", label: "5U (75-79g)" },
    { value: "6U", label: "6U (<75g)" },
];
const BALANCE_OPTIONS: FilterOption[] = [
    { value: "HEAD_HEAVY", label: "Head Heavy" },
    { value: "EVEN", label: "Even" },
    { value: "HEAD_LIGHT", label: "Head Light" },
];
const SHAFT_OPTIONS: FilterOption[] = [
    { value: "STIFF", label: "Stiff" },
    { value: "MEDIUM", label: "Medium" },
    { value: "FLEXIBLE", label: "Flexible" },
];
const GRIP_OPTIONS: FilterOption[] = [
    { value: "G2", label: "G2" },
    { value: "G3", label: "G3" },
    { value: "G4", label: "G4" },
    { value: "G5", label: "G5" },
    { value: "G6", label: "G6" },
];

export function SearchFiltersPanel({
    categories,
    conditions,
    genders,
    priceRange,
    currentFilters,
    facetCounts,
}: SearchFiltersPanelProps) {
    function getFacetCount(facet: string, value: string): number | null {
        if (!facetCounts) return null;
        const bucket = facetCounts[facet];
        if (!bucket) return null;
        return bucket[value] ?? 0;
    }
    const router = useRouter();
    const searchParams = useSearchParams();
    const [openSections, setOpenSections] = useState({
        category: true,
        price: true,
        condition: true,
        gender: true,
        weightClass: true,
        balance: true,
        shaftFlex: false,
        gripSize: false,
    });

    function toggleCsvValue(key: "weightClass" | "balance" | "shaftFlex" | "gripSize", value: string) {
        const params = new URLSearchParams(searchParams.toString());
        const existing = (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        const next = existing.includes(value)
            ? existing.filter((v) => v !== value)
            : [...existing, value];
        if (next.length === 0) {
            params.delete(key);
        } else {
            params.set(key, next.join(","));
        }
        params.delete("page");
        router.push(`/search?${params.toString()}`);
    }

    function isCsvValueActive(rawValue: string | undefined, value: string): boolean {
        if (!rawValue) return false;
        return rawValue.split(",").map((s) => s.trim()).includes(value);
    }

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
                        {conditions.map((cond) => {
                            const count = getFacetCount("condition", cond.value);
                            const disabled = count === 0 && currentFilters.condition !== cond.value;
                            return (
                                <button
                                    key={cond.value}
                                    onClick={() => applyFilter("condition", cond.value)}
                                    disabled={disabled}
                                    className={`w-full flex justify-between items-center text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentFilters.condition === cond.value
                                            ? "bg-brand-primary text-white"
                                            : disabled
                                                ? "text-slate-400 cursor-not-allowed"
                                                : "hover:bg-slate-100 text-slate-700"
                                        }`}
                                >
                                    <span>{cond.label}</span>
                                    {count !== null && (
                                        <span className={`text-xs font-mono ${currentFilters.condition === cond.value ? "text-white/80" : "text-slate-400"}`}>
                                            ({count})
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Gender Filter */}
            <div className="border-b border-slate-100">
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
                        {genders.map((g) => {
                            const count = getFacetCount("gender", g.value);
                            const disabled = count === 0 && currentFilters.gender !== g.value;
                            return (
                                <button
                                    key={g.value}
                                    onClick={() => applyFilter("gender", g.value)}
                                    disabled={disabled}
                                    className={`w-full flex justify-between items-center text-left px-3 py-2 rounded-lg text-sm transition-colors ${currentFilters.gender === g.value
                                        ? "bg-brand-primary text-white"
                                        : disabled
                                            ? "text-slate-400 cursor-not-allowed"
                                            : "hover:bg-slate-100 text-slate-700"
                                        }`}
                                >
                                    <span>{g.label}</span>
                                    {count !== null && (
                                        <span className={`text-xs font-mono ${currentFilters.gender === g.value ? "text-white/80" : "text-slate-400"}`}>
                                            ({count})
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* NICHE-02: Spec filters */}
            {(["weightClass", "balance", "shaftFlex", "gripSize"] as const).map((key) => {
                const meta = {
                    weightClass: { label: "Bobot (Weight)", options: WEIGHT_OPTIONS },
                    balance: { label: "Balance", options: BALANCE_OPTIONS },
                    shaftFlex: { label: "Shaft Flex", options: SHAFT_OPTIONS },
                    gripSize: { label: "Grip Size", options: GRIP_OPTIONS },
                }[key];
                const isLast = key === "gripSize";
                return (
                    <div key={key} className={isLast ? undefined : "border-b border-slate-100"}>
                        <button
                            onClick={() => toggleSection(key)}
                            className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                        >
                            <span className="font-medium text-slate-700">{meta.label}</span>
                            {openSections[key] ? (
                                <ChevronUp className="w-4 h-4 text-slate-400" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            )}
                        </button>
                        {openSections[key] && (
                            <div className="px-4 pb-4 grid grid-cols-1 gap-1.5">
                                {meta.options.map((opt) => {
                                    const active = isCsvValueActive(currentFilters[key], opt.value);
                                    const count = getFacetCount(key, opt.value);
                                    const disabled = count === 0 && !active;
                                    return (
                                        <label
                                            key={opt.value}
                                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-brand-primary/10 text-brand-primary" : disabled ? "text-slate-400 cursor-not-allowed" : "hover:bg-slate-100 text-slate-700 cursor-pointer"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={active}
                                                    disabled={disabled}
                                                    onChange={() => toggleCsvValue(key, opt.value)}
                                                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary disabled:cursor-not-allowed"
                                                />
                                                <span>{opt.label}</span>
                                            </div>
                                            {count !== null && (
                                                <span className="text-xs font-mono text-slate-400">({count})</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
