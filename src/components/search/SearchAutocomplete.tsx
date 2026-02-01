"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, Tag, ArrowRight, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { searchAutocomplete, getPopularSearches } from "@/actions/search";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchAutocompleteProps {
    className?: string;
    placeholder?: string;
}

// Infer types from the server action
type AutocompleteResult = Awaited<ReturnType<typeof searchAutocomplete>>;
type Suggestion = AutocompleteResult["suggestions"][number];
type CategorySuggestion = AutocompleteResult["categories"][number];

export function SearchAutocomplete({
    className = "",
    placeholder = "Cari raket, sepatu, tas...",
}: SearchAutocompleteProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [categories, setCategories] = useState<CategorySuggestion[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [popularSearches, setPopularSearches] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const debouncedQuery = useDebounce(query, 300);

    // Load recent and popular searches
    useEffect(() => {
        // Recent searches from localStorage
        try {
            const stored = localStorage.getItem("recentSearches");
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch {
            // Ignore
        }

        // Popular searches from server
        getPopularSearches().then(setPopularSearches).catch(console.error);
    }, []);

    // Fetch autocomplete suggestions
    useEffect(() => {
        if (debouncedQuery.length < 2) {
            setSuggestions([]);
            setCategories([]);
            return;
        }

        setIsLoading(true);
        searchAutocomplete(debouncedQuery)
            .then((result) => {
                setSuggestions(result.suggestions || []);
                setCategories(result.categories || []);
            })
            .catch(console.error)
            .finally(() => setIsLoading(false));
    }, [debouncedQuery]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSearch = useCallback(
        (searchQuery: string) => {
            if (!searchQuery.trim()) return;

            // Save to recent searches
            try {
                const stored = localStorage.getItem("recentSearches");
                const recent = stored ? JSON.parse(stored) : [];
                const updated = [
                    searchQuery,
                    ...recent.filter((s: string) => s !== searchQuery),
                ].slice(0, 10);
                localStorage.setItem("recentSearches", JSON.stringify(updated));
                setRecentSearches(updated);
            } catch {
                // Ignore
            }

            setIsOpen(false);
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        },
        [router]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSearch(query);
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    const clearRecentSearches = () => {
        localStorage.removeItem("recentSearches");
        setRecentSearches([]);
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const showDropdown =
        isOpen && (query.length >= 2 || recentSearches.length > 0 || popularSearches.length > 0);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery("");
                            inputRef.current?.focus();
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                )}
            </div>

            {/* Dropdown */}
            {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden">
                    {/* Loading */}
                    {isLoading && (
                        <div className="p-4 text-center text-slate-500">
                            <div className="animate-pulse">Mencari...</div>
                        </div>
                    )}

                    {/* No Query - Show Recent & Popular */}
                    {!query && !isLoading && (
                        <>
                            {/* Recent Searches */}
                            {recentSearches.length > 0 && (
                                <div className="p-3 border-b border-slate-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 uppercase">
                                            Pencarian Terakhir
                                        </span>
                                        <button
                                            onClick={clearRecentSearches}
                                            className="text-xs text-slate-400 hover:text-red-500"
                                        >
                                            Hapus
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {recentSearches.slice(0, 5).map((search, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSearch(search)}
                                                className="flex items-center gap-2 w-full p-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm text-slate-700">{search}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Popular Searches */}
                            {popularSearches.length > 0 && (
                                <div className="p-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                                        <TrendingUp className="w-3 h-3" />
                                        Populer
                                    </span>
                                    <div className="flex flex-wrap gap-2">
                                        {popularSearches.map((search, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSearch(search)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-700 transition-colors"
                                            >
                                                {search}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Search Results */}
                    {query && !isLoading && (
                        <>
                            {/* Category Suggestions */}
                            {categories.length > 0 && (
                                <div className="p-3 border-b border-slate-100">
                                    <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                        Kategori
                                    </span>
                                    <div className="space-y-1">
                                        {categories.map((cat) => (
                                            <Link
                                                key={cat.id}
                                                href={`/search?category=${cat.slug}`}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <Tag className="w-4 h-4 text-brand-primary" />
                                                <span className="text-sm text-slate-700">{cat.name}</span>
                                                <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Product Suggestions */}
                            {suggestions.length > 0 && (
                                <div className="p-3">
                                    <span className="text-xs font-bold text-slate-500 uppercase mb-2 block">
                                        Produk
                                    </span>
                                    <div className="space-y-2">
                                        {suggestions.map((product) => (
                                            <Link
                                                key={product.id}
                                                href={`/product/${product.slug}`}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                                    {product.image ? (
                                                        <Image
                                                            src={product.image}
                                                            alt={product.title}
                                                            width={48}
                                                            height={48}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                            <Search className="w-5 h-5" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">
                                                        {product.title}
                                                    </p>
                                                    <p className="text-sm font-bold text-brand-primary">
                                                        {formatPrice(product.price)}
                                                    </p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* No Results */}
                            {suggestions.length === 0 && categories.length === 0 && (
                                <div className="p-6 text-center">
                                    <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-500 text-sm">
                                        Tidak ada hasil untuk "{query}"
                                    </p>
                                </div>
                            )}

                            {/* View All Results */}
                            {(suggestions.length > 0 || categories.length > 0) && (
                                <button
                                    onClick={() => handleSearch(query)}
                                    className="w-full p-3 text-center text-brand-primary font-medium hover:bg-slate-50 border-t border-slate-100 transition-colors"
                                >
                                    Lihat semua hasil untuk "{query}"
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
