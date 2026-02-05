"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, Package, Tag, Store, Loader2, X, ArrowRight } from "lucide-react";
import { useDebouncedCallback } from "use-debounce";

interface SearchResult {
    products: Array<{
        id: string;
        title: string;
        slug: string;
        price: string;
        images: string[] | null;
        condition: string;
        brand: string | null;
    }>;
    categories: Array<{
        id: string;
        name: string;
        slug: string;
        icon: string | null;
    }>;
    sellers: Array<{
        id: string;
        name: string;
        store_name: string | null;
        store_slug: string | null;
        image: string | null;
    }>;
}

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

export function SearchBar() {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [condition, setCondition] = useState("all");
    const [results, setResults] = useState<SearchResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounced search
    const debouncedSearch = useDebouncedCallback(async (searchQuery: string, cond: string) => {
        if (searchQuery.trim().length < 2) {
            setResults(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                q: searchQuery,
                condition: cond,
                limit: "8",
            });
            const res = await fetch(`/api/search?${params}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data);
                setIsOpen(true);
            }
        } catch (error) {
            console.error("Search error:", error);
        } finally {
            setIsLoading(false);
        }
    }, 300);

    // Handle search input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        debouncedSearch(value, condition);
    };

    // Handle condition change
    const handleConditionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        setCondition(value);
        if (query.trim().length >= 2) {
            debouncedSearch(query, value);
        }
    };

    // Handle form submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setIsOpen(false);
            const params = new URLSearchParams({ q: query });
            if (condition !== "all") {
                params.set("condition", condition);
            }
            router.push(`/search?${params}`);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on escape
    useEffect(() => {
        function handleEscape(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setIsOpen(false);
                inputRef.current?.blur();
            }
        }
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, []);

    const hasResults = results && (
        results.products.length > 0 ||
        results.categories.length > 0 ||
        results.sellers.length > 0
    );

    return (
        <div ref={containerRef} className="relative group w-full">
            <form onSubmit={handleSubmit}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                    ) : (
                        <Search className="w-4 h-4 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                    )}
                </div>
                <input
                    ref={inputRef}
                    value={query}
                    onChange={handleInputChange}
                    onFocus={() => {
                        if (query.trim().length >= 2 && results) {
                            setIsOpen(true);
                        }
                    }}
                    className="block w-full pl-9 pr-24 py-2.5 border border-slate-200 rounded-full leading-5 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all"
                    placeholder="Cari raket, sepatu, tas..."
                    type="text"
                    autoComplete="off"
                />
                {/* Clear button */}
                {query && (
                    <button
                        type="button"
                        onClick={() => {
                            setQuery("");
                            setResults(null);
                            setIsOpen(false);
                            inputRef.current?.focus();
                        }}
                        className="absolute inset-y-0 right-20 flex items-center px-2 text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                {/* Condition filter */}
                <div className="absolute inset-y-0 right-0 flex items-center">
                    <select
                        value={condition}
                        onChange={handleConditionChange}
                        className="h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-slate-500 text-xs font-medium rounded-r-md focus:ring-0 focus:border-transparent cursor-pointer hover:text-brand-primary transition-colors border-l border-slate-200"
                    >
                        <option value="all">Semua</option>
                        <option value="NEW">Baru</option>
                        <option value="PRELOVED">Preloved</option>
                    </select>
                </div>
            </form>

            {/* Search Results Dropdown */}
            {isOpen && query.trim().length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50 max-h-[70vh] overflow-y-auto">
                    {!hasResults && !isLoading ? (
                        <div className="p-8 text-center text-slate-500">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
                            <p className="font-medium">Tidak ditemukan hasil untuk "{query}"</p>
                            <p className="text-sm mt-1">Coba kata kunci lain atau periksa ejaan</p>
                        </div>
                    ) : (
                        <>
                            {/* Categories */}
                            {results?.categories && results.categories.length > 0 && (
                                <div className="p-3 border-b border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                                        Kategori
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {results.categories.map((cat) => (
                                            <Link
                                                key={cat.id}
                                                href={`/category/${cat.slug}`}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-brand-primary hover:text-white rounded-full text-sm font-medium text-slate-700 transition-colors"
                                            >
                                                <Tag className="w-3 h-3" />
                                                {cat.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Sellers */}
                            {results?.sellers && results.sellers.length > 0 && (
                                <div className="p-3 border-b border-slate-100">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                                        Toko
                                    </p>
                                    <div className="space-y-1">
                                        {results.sellers.map((seller) => (
                                            <Link
                                                key={seller.id}
                                                href={`/store/${seller.store_slug}`}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center overflow-hidden">
                                                    {seller.image ? (
                                                        <Image
                                                            src={seller.image}
                                                            alt={seller.store_name || seller.name}
                                                            width={32}
                                                            height={32}
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <Store className="w-4 h-4 text-brand-primary" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-900">
                                                        {seller.store_name || seller.name}
                                                    </p>
                                                    <p className="text-xs text-slate-500">Toko</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Products */}
                            {results?.products && results.products.length > 0 && (
                                <div className="p-3">
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">
                                        Produk
                                    </p>
                                    <div className="space-y-1">
                                        {results.products.map((product) => (
                                            <Link
                                                key={product.id}
                                                href={`/product/${product.slug}`}
                                                onClick={() => setIsOpen(false)}
                                                className="flex items-center gap-3 px-2 py-2 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 relative">
                                                    {product.images && product.images[0] ? (
                                                        <Image
                                                            src={product.images[0]}
                                                            alt={product.title}
                                                            fill
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-900 truncate">
                                                        {product.title}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-brand-primary">
                                                            {formatPrice(product.price)}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${product.condition === "NEW"
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-orange-100 text-orange-700"
                                                            }`}>
                                                            {product.condition === "NEW" ? "Baru" : "Preloved"}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* View all results */}
                            {hasResults && (
                                <Link
                                    href={`/search?q=${encodeURIComponent(query)}${condition !== "all" ? `&condition=${condition}` : ""}`}
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center justify-center gap-2 p-3 bg-slate-50 text-brand-primary font-medium text-sm hover:bg-slate-100 transition-colors border-t border-slate-200"
                                >
                                    Lihat semua hasil untuk "{query}"
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
