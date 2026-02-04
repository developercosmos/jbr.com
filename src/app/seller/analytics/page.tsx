import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, Calendar, Package } from "lucide-react";
import { getSellerStats, getRecentSellerOrders } from "@/actions/orders";
import Image from "next/image";

function formatPrice(amount: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(amount);
}

export default async function SellerAnalyticsPage() {
    const stats = await getSellerStats();
    const recentOrders = await getRecentSellerOrders(10);

    // Get top products from recent orders
    const productSales: Record<string, { title: string; image: string | null; count: number }> = {};
    recentOrders.forEach(order => {
        order.items.forEach(item => {
            const productId = item.product.id;
            if (!productSales[productId]) {
                productSales[productId] = {
                    title: item.product.title,
                    image: item.product.images?.[0] || null,
                    count: 0,
                };
            }
            productSales[productId].count += item.quantity;
        });
    });

    const topProducts = Object.values(productSales)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Analisis Toko
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Pantau performa penjualan dan pertumbuhan toko Anda.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm">
                                30 Hari
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                3 Bulan
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                1 Tahun
                            </button>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                            <Calendar className="w-4 h-4" />
                            Custom Date
                        </button>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Revenue */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                Aktif
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Pendapatan</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{formatPrice(stats.totalRevenue)}</h3>
                    </div>
                    {/* Orders */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-medium text-slate-400 px-2 py-1">
                                Hari ini: {stats.newOrdersCount}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Item Terjual</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalItemsSold}</h3>
                    </div>
                    {/* Products */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                <Package className="w-5 h-5" />
                            </div>
                            {stats.lowStockCount > 0 && (
                                <span className="text-xs font-medium text-orange-500 bg-orange-50 dark:bg-orange-900/10 px-2 py-1 rounded-full">
                                    {stats.lowStockCount} stok rendah
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Produk Aktif</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.productCount}</h3>
                    </div>
                    {/* Rating */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-medium text-yellow-500 px-2 py-1">
                                ⭐ Rating
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Rating Toko</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.rating} / 5.0</h3>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart - Placeholder */}
                    <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Grafik Pendapatan</h3>
                        <div className="h-64 flex items-center justify-center text-center">
                            <div className="text-slate-400">
                                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-sm">Grafik pendapatan akan tampil setelah ada data penjualan lebih lanjut</p>
                            </div>
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Produk Terlaris</h3>
                        {topProducts.length === 0 ? (
                            <div className="h-64 flex items-center justify-center text-center">
                                <div className="text-slate-400">
                                    <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">Belum ada data penjualan</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {topProducts.map((product, i) => (
                                    <div key={i} className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden relative flex-shrink-0">
                                            {product.image ? (
                                                <Image
                                                    src={product.image}
                                                    alt={product.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            ) : (
                                                <div className="flex items-center justify-center w-full h-full">
                                                    <Package className="w-5 h-5 text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{product.title}</h4>
                                            <p className="text-xs text-slate-500">{product.count} Terjual</p>
                                        </div>
                                        <span className="text-sm font-bold text-brand-primary">#{i + 1}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <button className="w-full mt-6 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors">
                            Lihat Semua Produk
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
