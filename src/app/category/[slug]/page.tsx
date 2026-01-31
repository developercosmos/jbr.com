import { ProductGrid } from "@/components/home/ProductGrid";
import { Filter, ChevronDown } from "lucide-react";

export default function CategoryPage({ params }: { params: { slug: string } }) {
    // Format slug to title case (e.g., "badminton-rackets" -> "Badminton Rackets")
    const title = params.slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-black/20 pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-surface-dark border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-4">
                        {title}
                    </h1>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="text-slate-500 dark:text-slate-400">
                            Menampilkan 124 produk untuk kategori "{title}"
                        </p>
                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                                <Filter className="w-4 h-4" />
                                Filter
                            </button>
                            <div className="relative">
                                <select className="appearance-none pl-4 pr-10 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium focus:outline-none cursor-pointer">
                                    <option>Paling Relevan</option>
                                    <option>Terbaru</option>
                                    <option>Harga Terendah</option>
                                    <option>Harga Tertinggi</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <ProductGrid />
            </div>
        </main>
    );
}
