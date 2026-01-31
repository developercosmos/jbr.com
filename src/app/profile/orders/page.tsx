import Link from "next/link";
import Image from "next/image";
import { Search, Filter, Package, Truck, CheckCircle, Clock } from "lucide-react";

export default function ProfileOrdersPage() {
    return (
        <div className="flex-1">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-2">
                    Pesanan Saya
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Riwayat belanja dan status pesanan Anda.
                </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex overflow-x-auto pb-2 mb-6 gap-2 no-scrollbar">
                <button className="px-4 py-2 rounded-full bg-brand-primary text-white text-sm font-bold whitespace-nowrap shadow-md shadow-brand-primary/25">
                    Semua Pesanan
                </button>
                <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                    Menunggu Pembayaran
                </button>
                <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                    Diproses
                </button>
                <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                    Dikirim
                </button>
                <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                    Selesai
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder="Cari pesanan berdasarkan nama produk atau ID..."
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all shadow-sm"
                />
            </div>

            {/* Orders List */}
            <div className="space-y-6">
                {/* Order Card 1 */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/5">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-slate-900 dark:text-white">19 Des 2025</span>
                            <span className="text-slate-400">|</span>
                            <span className="font-mono text-slate-500">ORD-2839</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-600 dark:text-slate-300">Agus Sport Store</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50 uppercase tracking-wide">
                            <Truck className="w-3 h-3 mr-1" />
                            Sedang Dikirim
                        </span>
                    </div>
                    <div className="p-4 flex flex-col sm:flex-row gap-4">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <Image
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIaF_lSZ7Pxl2d96PA8BCRBrdPH42wW783ImbT7w8ufOm4cteDQpCZAMda9XdBG6RDdX8tDO7X-mF1iBrDebNfjwGQQbdSn4oW_7r3a2KvC6ZgmE6WB2s_YFz5vO2n1Jy4h0QRpg9NH4vIt-9y5oQ9ScsGsrRi1uqxZ8ErOTAeG4i9JIinF9qS6bs7GZdsaY2BIBmDuMAx8_uKaTTy37FIbrdDQdyb8njxQdGNT3NofDa8FOV9p7fTY2HAdVcX3UuQxcP0b-UnqO4"
                                alt="Product"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">
                                Nike Air Jordan Red
                            </h3>
                            <p className="text-sm text-slate-500 mb-2">1 x Rp 2.500.000</p>
                            <div className="flex items-center justify-between mt-4">
                                <div>
                                    <p className="text-xs text-slate-500">Total Belanja</p>
                                    <p className="font-bold text-brand-primary text-lg">Rp 2.520.000</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        Lacak
                                    </button>
                                    <button className="px-4 py-2 rounded-lg bg-brand-primary text-white font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20">
                                        Diterima
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Card 2 */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/5">
                        <div className="flex items-center gap-4 text-sm">
                            <span className="font-bold text-slate-900 dark:text-white">10 Des 2025</span>
                            <span className="text-slate-400">|</span>
                            <span className="font-mono text-slate-500">ORD-2810</span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-600 dark:text-slate-300">Pro Shop Indonesia</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700/50 uppercase tracking-wide">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Selesai
                        </span>
                    </div>
                    <div className="p-4 flex flex-col sm:flex-row gap-4">
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                            <Image
                                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOQy9vRJqIQMmAmWRCB1SGC99BPsLlljsIZ2755XuqU-0grLUuh4vsiJkgUtxxNduBzXhAfSaZ0UeAQY6km0V7iYhiwjE-yfZ66E2ncSSpXM2KQOz40uPBHmQxXD2Z0edwc5Rbv2pinPtLyRfr22CrKr-SKbKEeeqm4bQqGmw3-ZsUnTk1SX14i3bdns3s-gjWtR536hpIJDJ5kgQZpBN7qc3UYqMUca54kPDiBDHXcVMr8oplziatKZjjrisrIGliYLBxSVNggws"
                                alt="Product"
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">
                                Nike Air Zoom Pegasus 39
                            </h3>
                            <p className="text-sm text-slate-500 mb-2">1 x Rp 1.200.000</p>
                            <div className="flex items-center justify-between mt-4">
                                <div>
                                    <p className="text-xs text-slate-500">Total Belanja</p>
                                    <p className="font-bold text-brand-primary text-lg">Rp 1.225.000</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        Beli Lagi
                                    </button>
                                    <button className="px-4 py-2 rounded-lg border border-brand-primary text-brand-primary font-bold text-sm hover:bg-brand-primary/5 transition-colors">
                                        Ulas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
