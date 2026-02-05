import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, Calendar, Activity, Package, Database, Cpu } from "lucide-react";
import { getAnalyticsStats } from "@/actions/admin";
import { getServerHealth } from "@/actions/health";

// Format currency
function formatCurrency(value: string | number) {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (num >= 1_000_000_000) return `Rp ${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `Rp ${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `Rp ${(num / 1_000).toFixed(1)}K`;
    return `Rp ${num.toLocaleString("id-ID")}`;
}

// Color palette for categories
const COLORS = [
    "bg-brand-primary",
    "bg-orange-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-pink-500",
    "bg-yellow-500",
    "bg-cyan-500",
    "bg-red-500",
];

export default async function AdminAnalyticsPage() {
    const [stats, serverHealth] = await Promise.all([
        getAnalyticsStats(),
        getServerHealth(),
    ]);

    // Calculate category percentages
    const totalProducts = stats.categoryDistribution.reduce((sum, cat) => sum + cat.count, 0);
    const categoryWithPercentage = stats.categoryDistribution.map((cat, index) => ({
        ...cat,
        percentage: totalProducts > 0 ? Math.round((cat.count / totalProducts) * 100) : 0,
        color: COLORS[index % COLORS.length],
    }));

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Platform Analytics
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Statistik performa keseluruhan marketplace JualBeliRaket.com.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-medium">
                            <Calendar className="w-4 h-4" />
                            30 Hari Terakhir
                        </span>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* GMV */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <TrendingUp className="w-3 h-3" />
                                Live
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total GMV</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(stats.gmv)}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Dari {stats.completedOrders} transaksi selesai</p>
                    </div>

                    {/* Active Users */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                Active
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">User Aktif</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats.activeUsers.toLocaleString("id-ID")}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Dalam 30 hari terakhir</p>
                    </div>

                    {/* Transactions */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/10 px-2 py-1 rounded-full">
                                Completed
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Transaksi Sukses</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {stats.completedOrders.toLocaleString("id-ID")}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{stats.pendingOrders} menunggu pembayaran</p>
                    </div>

                    {/* Products */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                <Package className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/10 px-2 py-1 rounded-full">
                                Published
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Produk</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {totalProducts.toLocaleString("id-ID")}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Produk aktif di marketplace</p>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Server Status - Real Data */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Status Server</h3>
                            <span className={`flex items-center gap-2 text-sm font-medium ${serverHealth.database.status === "ok"
                                    ? "text-green-600"
                                    : serverHealth.database.status === "slow"
                                        ? "text-yellow-600"
                                        : "text-red-600"
                                }`}>
                                <span className={`w-2 h-2 rounded-full animate-pulse ${serverHealth.database.status === "ok"
                                        ? "bg-green-500"
                                        : serverHealth.database.status === "slow"
                                            ? "bg-yellow-500"
                                            : "bg-red-500"
                                    }`}></span>
                                {serverHealth.database.status === "ok"
                                    ? "Semua Sistem Operasional"
                                    : serverHealth.database.status === "slow"
                                        ? "Response Lambat"
                                        : "Ada Masalah"}
                            </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            {/* Database Response Time */}
                            <div className={`text-center p-4 rounded-lg ${serverHealth.database.status === "ok"
                                    ? "bg-green-50 dark:bg-green-900/10"
                                    : serverHealth.database.status === "slow"
                                        ? "bg-yellow-50 dark:bg-yellow-900/10"
                                        : "bg-red-50 dark:bg-red-900/10"
                                }`}>
                                <Database className={`w-6 h-6 mx-auto mb-2 ${serverHealth.database.status === "ok"
                                        ? "text-green-600"
                                        : serverHealth.database.status === "slow"
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                    }`} />
                                <p className={`text-2xl font-bold ${serverHealth.database.status === "ok"
                                        ? "text-green-600"
                                        : serverHealth.database.status === "slow"
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                    }`}>
                                    {serverHealth.database.responseTime}ms
                                </p>
                                <p className="text-xs text-slate-500">Database</p>
                            </div>
                            {/* Memory Usage */}
                            <div className={`text-center p-4 rounded-lg ${serverHealth.memory.percentage < 70
                                    ? "bg-blue-50 dark:bg-blue-900/10"
                                    : serverHealth.memory.percentage < 90
                                        ? "bg-yellow-50 dark:bg-yellow-900/10"
                                        : "bg-red-50 dark:bg-red-900/10"
                                }`}>
                                <Cpu className={`w-6 h-6 mx-auto mb-2 ${serverHealth.memory.percentage < 70
                                        ? "text-blue-600"
                                        : serverHealth.memory.percentage < 90
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                    }`} />
                                <p className={`text-2xl font-bold ${serverHealth.memory.percentage < 70
                                        ? "text-blue-600"
                                        : serverHealth.memory.percentage < 90
                                            ? "text-yellow-600"
                                            : "text-red-600"
                                    }`}>
                                    {serverHealth.memory.percentage}%
                                </p>
                                <p className="text-xs text-slate-500">Memory</p>
                            </div>
                            {/* Uptime */}
                            <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
                                <Activity className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-purple-600">
                                    {serverHealth.uptime.percentage}%
                                </p>
                                <p className="text-xs text-slate-500">Uptime</p>
                            </div>
                        </div>
                    </div>

                    {/* Category Distribution */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Distribusi Kategori</h3>
                        {categoryWithPercentage.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                Belum ada produk di marketplace
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {categoryWithPercentage.slice(0, 6).map((cat) => (
                                    <div key={cat.categoryName} className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {cat.categoryName || "Tanpa Kategori"}
                                            </span>
                                            <span className="font-bold text-slate-900 dark:text-white">
                                                {cat.percentage}% ({cat.count})
                                            </span>
                                        </div>
                                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${cat.color} transition-all duration-500`}
                                                style={{ width: `${cat.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
