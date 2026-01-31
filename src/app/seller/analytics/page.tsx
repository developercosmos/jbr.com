import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Calendar } from "lucide-react";

export default function SellerAnalyticsPage() {
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
                                +12.5%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Pendapatan</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Rp 45.200.000</h3>
                    </div>
                    {/* Orders */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                +8.2%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Total Pesanan</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">1,240</h3>
                    </div>
                    {/* Visitors */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/10 px-2 py-1 rounded-full">
                                <ArrowDownRight className="w-3 h-3" />
                                -2.4%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Pengunjung Toko</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">8,530</h3>
                    </div>
                    {/* Conversion Rate */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-full">
                                <ArrowUpRight className="w-3 h-3" />
                                +1.8%
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Konversi Penjualan</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">3.2%</h3>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Grafik Pendapatan</h3>
                        <div className="h-64 flex items-end justify-between gap-2 w-full px-2">
                            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 95].map((height, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-sm relative h-56 group-hover:bg-brand-primary/20 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-sm transition-all duration-500 group-hover:bg-blue-600"
                                            style={{ height: `${height}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-400">{i + 1}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Products */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Produk Terlaris</h3>
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-lg bg-slate-100 dark:bg-slate-800 bg-cover bg-center" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAOQy9vRJqIQMmAmWRCB1SGC99BPsLlljsIZ2755XuqU-0grLUuh4vsiJkgUtxxNduBzXhAfSaZ0UeAQY6km0V7iYhiwjE-yfZ66E2ncSSpXM2KQOz40uPBHmQxXD2Z0edwc5Rbv2pinPtLyRfr22CrKr-SKbKEeeqm4bQqGmw3-ZsUnTk1SX14i3bdns3s-gjWtR536hpIJDJ5kgQZpBN7qc3UYqMUca54kPDiBDHXcVMr8oplziatKZjjrisrIGliYLBxSVNggws')" }}></div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">Nike Air Zoom Pegasus 39</h4>
                                        <p className="text-xs text-slate-500">124 Terjual</p>
                                    </div>
                                    <span className="text-sm font-bold text-brand-primary">#{i}</span>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-6 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary/5 rounded-lg transition-colors">
                            Lihat Semua Produk
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
