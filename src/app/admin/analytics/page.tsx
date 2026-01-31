import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Calendar, Activity } from "lucide-react";

export default function AdminAnalyticsPage() {
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
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                            <Calendar className="w-4 h-4" />
                            Bulan Ini
                        </button>
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
                                <ArrowUpRight className="w-3 h-3" />
                                +15.3%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total GMV</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Rp 1.2M</h3>
                    </div>
                    {/* Active Users */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                +5.4%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">User Aktif</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">15,420</h3>
                    </div>
                    {/* Transactions */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                +8.1%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Transaksi Sukses</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">3,890</h3>
                    </div>
                    {/* Server Load */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                <Activity className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/10 px-2 py-1 rounded-full">
                                Stabil
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Server Uptime</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">99.9%</h3>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* User Growth */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Pertumbuhan User</h3>
                        <div className="h-64 flex items-end justify-between gap-2 w-full px-2">
                            {[30, 40, 35, 50, 45, 60, 55, 70, 65, 80, 75, 90].map((height, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-blue-100 dark:bg-blue-900/20 rounded-t-sm relative h-56 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600"
                                            style={{ height: `${height}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-400">{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Category Distribution */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Distribusi Kategori</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Raket Badminton</span>
                                    <span className="font-bold text-slate-900 dark:text-white">45%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-primary w-[45%]"></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Sepatu Olahraga</span>
                                    <span className="font-bold text-slate-900 dark:text-white">25%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-orange-500 w-[25%]"></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Pakaian & Jersey</span>
                                    <span className="font-bold text-slate-900 dark:text-white">20%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 w-[20%]"></div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Aksesoris</span>
                                    <span className="font-bold text-slate-900 dark:text-white">10%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 w-[10%]"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
