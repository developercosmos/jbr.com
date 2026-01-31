import Link from "next/link";
import { Search, Bell, Plus, TrendingUp, ShoppingBag, Package, Star, ArrowRight, Truck, MessageCircle, AlertTriangle, ChevronRight } from "lucide-react";

export default function SellerDashboardPage() {
    return (
        <>
            {/* Header / Search Bar */}
            <header className="h-20 flex items-center justify-between px-8 py-4 bg-white/50 dark:bg-background-dark/50 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800/50">
                <div className="flex-1 max-w-xl">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-primary transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            autoComplete="off"
                            className="block w-full pl-10 pr-3 py-2.5 border-none rounded-xl leading-5 bg-slate-100 dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                            placeholder="Cari pesanan, produk, atau bantuan..."
                            type="text"
                        />
                    </div>
                </div>
                <div className="flex items-center gap-4 ml-6">
                    <button className="relative p-2 text-slate-400 hover:text-brand-primary transition-colors rounded-full hover:bg-slate-100 dark:hover:bg-white/5">
                        <Bell className="w-6 h-6" />
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-orange-500"></span>
                    </button>
                    <Link
                        href="/seller/products/add"
                        className="flex items-center gap-2 bg-brand-primary hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-primary/25"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Tambah Produk</span>
                    </Link>
                </div>
            </header>

            {/* Scrollable Content */}
            <div className="flex-1 p-8 scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-8">
                    {/* Page Heading */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                                Overview Penjualan
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400">
                                Ringkasan performa toko Anda hari ini,{" "}
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                    19 Desember 2025
                                </span>
                                .
                            </p>
                        </div>
                        <div className="flex items-center gap-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg p-1">
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white shadow-sm">
                                Hari Ini
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                7 Hari
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                30 Hari
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Revenue */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <TrendingUp className="w-16 h-16 text-brand-primary" />
                            </div>
                            <div className="flex flex-col h-full justify-between relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-green-500/10 rounded-lg">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Total Pendapatan
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                        Rp 15.500.000
                                    </h3>
                                    <p className="text-xs font-medium text-green-500 flex items-center gap-1">
                                        +12%{" "}
                                        <span className="text-slate-400 font-normal">
                                            dari kemarin
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* New Orders */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShoppingBag className="w-16 h-16 text-blue-400" />
                            </div>
                            <div className="flex flex-col h-full justify-between relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-blue-500/10 rounded-lg">
                                        <ShoppingBag className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Pesanan Baru
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                        12
                                    </h3>
                                    <p className="text-xs font-medium text-green-500 flex items-center gap-1">
                                        +5%{" "}
                                        <span className="text-slate-400 font-normal">
                                            dari kemarin
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Items Sold */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Package className="w-16 h-16 text-purple-400" />
                            </div>
                            <div className="flex flex-col h-full justify-between relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Package className="w-5 h-5 text-purple-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Produk Terjual
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                        45
                                    </h3>
                                    <p className="text-xs font-medium text-green-500 flex items-center gap-1">
                                        +2%{" "}
                                        <span className="text-slate-400 font-normal">
                                            dari kemarin
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                        {/* Rating */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Star className="w-16 h-16 text-orange-500" />
                            </div>
                            <div className="flex flex-col h-full justify-between relative z-10">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-2 bg-orange-500/10 rounded-lg">
                                        <Star className="w-5 h-5 text-orange-500" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Rating Toko
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-1">
                                        4.8{" "}
                                        <span className="text-sm text-slate-400 font-normal">
                                            / 5.0
                                        </span>
                                    </h3>
                                    <p className="text-xs font-medium text-green-500 flex items-center gap-1">
                                        +0.1%{" "}
                                        <span className="text-slate-400 font-normal">
                                            dari bulan lalu
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Section Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart Section */}
                        <div className="lg:col-span-2 bg-white dark:bg-surface-dark rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Statistik Pendapatan
                                </h3>
                                <button className="text-brand-primary text-sm font-medium hover:underline">
                                    Lihat Detail
                                </button>
                            </div>
                            {/* CSS-only Bar Chart visualization */}
                            <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 w-full">
                                {/* Bar 1 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "45%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Sn</span>
                                </div>
                                {/* Bar 2 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "65%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Sl</span>
                                </div>
                                {/* Bar 3 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "35%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Rb</span>
                                </div>
                                {/* Bar 4 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "85%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Km</span>
                                </div>
                                {/* Bar 5 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "55%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Jm</span>
                                </div>
                                {/* Bar 6 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "90%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs text-slate-500">Sb</span>
                                </div>
                                {/* Bar 7 */}
                                <div className="flex flex-col items-center gap-2 w-full group">
                                    <div className="w-full bg-brand-primary/10 dark:bg-brand-primary/20 rounded-t-lg relative h-32 group-hover:bg-brand-primary/30 transition-colors">
                                        <div
                                            className="absolute bottom-0 w-full bg-brand-primary rounded-t-lg transition-all duration-500"
                                            style={{ height: "70%" }}
                                        ></div>
                                    </div>
                                    <span className="text-xs font-bold text-brand-primary">
                                        Mg
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Needed Section */}
                        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                            <div className="p-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                                    Perlu Perhatian
                                </h3>
                            </div>
                            <div className="p-4 flex flex-col gap-3 overflow-y-auto">
                                {/* Action Item 1 */}
                                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800/50">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                        <Truck className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            5 Pesanan perlu dikirim
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            Segera proses sebelum pkl 16.00
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                                {/* Action Item 2 */}
                                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800/50">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <MessageCircle className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            2 Diskusi Produk Baru
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            Balas pertanyaan calon pembeli
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                                {/* Action Item 3 */}
                                <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black/20 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer border border-slate-100 dark:border-slate-800/50">
                                    <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
                                        <Package className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            1 Stok Produk Menipis
                                        </p>
                                        <p className="text-xs text-slate-500 truncate">
                                            Nike Air Zoom Pegasus 38
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Orders Table */}
                    <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                Pesanan Terakhir
                            </h3>
                            <Link
                                href="/seller/orders"
                                className="text-sm font-bold text-brand-primary hover:text-blue-400 flex items-center gap-1"
                            >
                                Lihat Semua Pesanan
                                <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                        <th className="px-6 py-4 font-semibold">Produk</th>
                                        <th className="px-6 py-4 font-semibold">ID Pesanan</th>
                                        <th className="px-6 py-4 font-semibold">Pembeli</th>
                                        <th className="px-6 py-4 font-semibold">Kondisi</th>
                                        <th className="px-6 py-4 font-semibold text-right">
                                            Total
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-center">
                                            Status
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {/* Row 1 */}
                                    <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 bg-center bg-cover"
                                                    style={{
                                                        backgroundImage:
                                                            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAIaF_lSZ7Pxl2d96PA8BCRBrdPH42wW783ImbT7w8ufOm4cteDQpCZAMda9XdBG6RDdX8tDO7X-mF1iBrDebNfjwGQQbdSn4oW_7r3a2KvC6ZgmE6WB2s_YFz5vO2n1Jy4h0QRpg9NH4vIt-9y5oQ9ScsGsrRi1uqxZ8ErOTAeG4i9JIinF9qS6bs7GZdsaY2BIBmDuMAx8_uKaTTy37FIbrdDQdyb8njxQdGNT3NofDa8FOV9p7fTY2HAdVcX3UuQxcP0b-UnqO4')",
                                                    }}
                                                ></div>
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    Nike Air Jordan Red
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500">
                                            #ORD-2839
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300">
                                            Budi Santoso
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                Baru
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-right text-slate-900 dark:text-white">
                                            Rp 2.500.000
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50">
                                                Perlu Dikirim
                                            </span>
                                        </td>
                                    </tr>
                                    {/* Row 2 */}
                                    <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 bg-center bg-cover"
                                                    style={{
                                                        backgroundImage:
                                                            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBs0GkRmYjsiWzaO4wQT9HcN9T65beA7GTvR4zLZ-W9QBG-e4Pr01t6w8CSIFe-oRNjOp7WF1CVwYqcmg7iX2KwiMoxcchp6CkhwpqgMGxI_LpKmJ_9Os6wjS4lGkaIA__q1G7tlWuLzzjBsI3yqTTCJMSYo3IKMET1w7KM26K_1Je4_hfa_v3f-O0UQeWCsOvwMAE2KSdPP7ABBffZGB9dXZ8fBNh6scx6TrZj5Zsf6zt7CR5aEq1shkwtrocFKq2uER0srdH0kow')",
                                                    }}
                                                ></div>
                                                <div className="font-medium text-slate-900 dark:text-white">
                                                    Wilson Tennis Racket
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-slate-500">
                                            #ORD-2838
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300">
                                            Siti Aminah
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                                Pre-loved
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-right text-slate-900 dark:text-white">
                                            Rp 850.000
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50">
                                                Perlu Dikirim
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                <footer className="mt-12 text-center text-slate-500 text-sm py-4 border-t border-slate-200 dark:border-slate-800">
                    © 2025 JualBeliRaket.com. All rights reserved.
                </footer>
            </div >
        </>
    );
}
