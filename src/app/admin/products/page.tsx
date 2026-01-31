import { Search, Filter, Download, Eye, MoreHorizontal, Trash2, CheckCircle, XCircle } from "lucide-react";
import Image from "next/image";

export default function AdminProductsPage() {
    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Manajemen Produk
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola semua produk yang terdaftar di platform.
                        </p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari nama produk, SKU, atau penjual..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap">
                            <Filter className="w-4 h-4" />
                            Filter Kategori
                        </button>
                        <select className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium cursor-pointer">
                            <option>Semua Status</option>
                            <option>Aktif</option>
                            <option>Non-Aktif</option>
                            <option>Perlu Review</option>
                        </select>
                    </div>
                </div>

                {/* Products Table */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 font-semibold">Produk</th>
                                    <th className="px-6 py-4 font-semibold">Penjual</th>
                                    <th className="px-6 py-4 font-semibold">Kategori</th>
                                    <th className="px-6 py-4 font-semibold text-right">Harga</th>
                                    <th className="px-6 py-4 font-semibold text-center">Stok</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                    <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {/* Row 1 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
                                                <Image
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIaF_lSZ7Pxl2d96PA8BCRBrdPH42wW783ImbT7w8ufOm4cteDQpCZAMda9XdBG6RDdX8tDO7X-mF1iBrDebNfjwGQQbdSn4oW_7r3a2KvC6ZgmE6WB2s_YFz5vO2n1Jy4h0QRpg9NH4vIt-9y5oQ9ScsGsrRi1uqxZ8ErOTAeG4i9JIinF9qS6bs7GZdsaY2BIBmDuMAx8_uKaTTy37FIbrdDQdyb8njxQdGNT3NofDa8FOV9p7fTY2HAdVcX3UuQxcP0b-UnqO4"
                                                    alt="Product"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900 dark:text-white text-sm">
                                                    Nike Air Jordan Red
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    SKU: NK-AJ-001
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        Agus Sport Store
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        Sepatu
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                        Rp 2.500.000
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center text-slate-600 dark:text-slate-300">
                                        12
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700/50">
                                            Aktif
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="Lihat Detail">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" title="Hapus">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 2 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 relative overflow-hidden">
                                                <Image
                                                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAOQy9vRJqIQMmAmWRCB1SGC99BPsLlljsIZ2755XuqU-0grLUuh4vsiJkgUtxxNduBzXhAfSaZ0UeAQY6km0V7iYhiwjE-yfZ66E2ncSSpXM2KQOz40uPBHmQxXD2Z0edwc5Rbv2pinPtLyRfr22CrKr-SKbKEeeqm4bQqGmw3-ZsUnTk1SX14i3bdns3s-gjWtR536hpIJDJ5kgQZpBN7qc3UYqMUca54kPDiBDHXcVMr8oplziatKZjjrisrIGliYLBxSVNggws"
                                                    alt="Product"
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900 dark:text-white text-sm">
                                                    Nike Air Zoom Pegasus
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                    SKU: NK-ZP-039
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        Pro Shop Indonesia
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        Sepatu
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                        Rp 1.200.000
                                    </td>
                                    <td className="px-6 py-4 text-sm text-center text-slate-600 dark:text-slate-300">
                                        45
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50">
                                            Review
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 rounded-lg transition-colors" title="Setujui">
                                                <CheckCircle className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" title="Tolak">
                                                <XCircle className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
