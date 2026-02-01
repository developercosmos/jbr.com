import { Suspense } from "react";
import { Search, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { searchProducts, getSearchFilters } from "@/actions/search";
import { SearchFiltersPanel } from "./SearchFiltersPanel";
import { SearchPagination } from "./SearchPagination";

interface SearchPageProps {
    searchParams: Promise<{
        q?: string;
        category?: string;
        minPrice?: string;
        maxPrice?: string;
        condition?: string;
        gender?: string;
        sort?: string;
        page?: string;
    }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
    const params = await searchParams;
    const query = params.q || "";
    const page = parseInt(params.page || "1", 10);

    const [results, filters] = await Promise.all([
        searchProducts({
            query,
            category: params.category,
            minPrice: params.minPrice ? parseFloat(params.minPrice) : undefined,
            maxPrice: params.maxPrice ? parseFloat(params.maxPrice) : undefined,
            condition: params.condition as "NEW" | "PRELOVED" | undefined,
            gender: params.gender as "UNISEX" | "MEN" | "WOMEN" | undefined,
            sortBy: (params.sort as "relevance" | "price_asc" | "price_desc" | "newest" | "popular") || "relevance",
            page,
            limit: 24,
        }),
        getSearchFilters(),
    ]);

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    // Build current filter summary
    const activeFilters: string[] = [];
    if (params.category) activeFilters.push(`Kategori: ${params.category}`);
    if (params.condition) activeFilters.push(`Kondisi: ${params.condition}`);
    if (params.gender) activeFilters.push(`Gender: ${params.gender}`);
    if (params.minPrice || params.maxPrice) {
        activeFilters.push(`Harga: ${params.minPrice || "0"} - ${params.maxPrice || "∞"}`);
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {query ? `Hasil pencarian "${query}"` : "Semua Produk"}
                    </h1>
                    <p className="text-slate-600">
                        {results.total} produk ditemukan
                    </p>
                </div>

                <div className="flex gap-6">
                    {/* Filters Sidebar */}
                    <aside className="hidden lg:block w-64 flex-shrink-0">
                        <Suspense fallback={<div className="animate-pulse bg-slate-200 h-96 rounded-xl" />}>
                            <SearchFiltersPanel
                                categories={filters.categories}
                                conditions={filters.conditions}
                                genders={filters.genders}
                                priceRange={filters.priceRange}
                                currentFilters={params}
                            />
                        </Suspense>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1">
                        {/* Sort & Active Filters */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
                            <div className="flex items-center justify-between flex-wrap gap-3">
                                {/* Sort */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-600">Urutkan:</span>
                                    <select
                                        defaultValue={params.sort || "relevance"}
                                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary"
                                        onChange={(e) => {
                                            const url = new URL(window.location.href);
                                            url.searchParams.set("sort", e.target.value);
                                            url.searchParams.delete("page");
                                            window.location.href = url.toString();
                                        }}
                                    >
                                        {filters.sortOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Active Filters */}
                                {activeFilters.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {activeFilters.map((filter, idx) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded-full"
                                            >
                                                {filter}
                                            </span>
                                        ))}
                                        <Link
                                            href={`/search${query ? `?q=${encodeURIComponent(query)}` : ""}`}
                                            className="text-xs text-slate-500 hover:text-red-500"
                                        >
                                            Hapus Filter
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Products Grid */}
                        {results.products.length === 0 ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                                <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                <h2 className="text-lg font-bold text-slate-700 mb-2">
                                    Tidak Ada Produk Ditemukan
                                </h2>
                                <p className="text-slate-500 mb-4">
                                    Coba ubah kata kunci atau filter pencarian Anda.
                                </p>
                                <Link
                                    href="/search"
                                    className="inline-block px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
                                >
                                    Lihat Semua Produk
                                </Link>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {results.products.map((product) => (
                                        <Link
                                            key={product.id}
                                            href={`/product/${product.slug}`}
                                            className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
                                        >
                                            <div className="aspect-square relative bg-slate-100">
                                                <Image
                                                    src={product.images?.[0] || "/placeholder.png"}
                                                    alt={product.title}
                                                    fill
                                                    className="object-cover group-hover:scale-105 transition-transform"
                                                />
                                                {product.condition === "NEW" && (
                                                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">
                                                        BARU
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <h3 className="text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-brand-primary transition-colors mb-1">
                                                    {product.title}
                                                </h3>
                                                <p className="text-sm font-bold text-brand-primary">
                                                    {formatPrice(product.price)}
                                                </p>
                                                {product.seller && (
                                                    <p className="text-xs text-slate-500 mt-1 truncate">
                                                        {product.seller.name}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {results.totalPages > 1 && (
                                    <SearchPagination
                                        currentPage={results.page}
                                        totalPages={results.totalPages}
                                        baseUrl={`/search?q=${encodeURIComponent(query)}`}
                                    />
                                )}
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
