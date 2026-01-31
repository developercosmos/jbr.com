import Link from "next/link";
import { Search, Filter, Download, Eye, MoreHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function AdminOrdersPage() {
    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Semua Pesanan
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Pantau dan kelola seluruh transaksi di platform.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                            <Download className="w-4 h-4" />
                            Export Laporan
                        </button>
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
                            placeholder="Cari ID, Penjual, atau Pembeli..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap">
                            <Filter className="w-4 h-4" />
                            Filter Status
                        </button>
                        <select className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium cursor-pointer">
                            <option>Semua Kategori</option>
                            <option>Raket</option>
                            <option>Sepatu</option>
                            <option>Aksesoris</option>
                        </select>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                    <th className="px-6 py-4 font-semibold">
                                        <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                                            ID Transaksi
                                            <ArrowUpDown className="w-3 h-3" />
                                        </div>
                                    </th>
                                    <th className="px-6 py-4 font-semibold">Penjual</th>
                                    <th className="px-6 py-4 font-semibold">Pembeli</th>
                                    <th className="px-6 py-4 font-semibold">Tanggal</th>
                                    <th className="px-6 py-4 font-semibold text-right">Total</th>
                                    <th className="px-6 py-4 font-semibold text-center">Status</th>
                                    <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {/* Row 1 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono text-brand-primary font-medium">
                                        #TRX-9928
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 bg-center bg-cover" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAfJ_rQ7u8EpmlEIZh8AhOgadR-KpG_LMMPS_uuFzXPZJci9HR3qzqn0YHBn1HFwntSwJhibQhWHwhJCmn0zxKyiPvlqI4oAkffJhLgafsxG7-puHg4qKrWOPogi9j00LBzw2SQsPOyeBqNHS8joKwOu5Zj8Y4WjjHtvMcbA5Yx4r-69XFQbcZ-1ZCeML1d9qIgkAULNSyRRlhvjkWpevv7qCwUTkmSXKheWlFMt4mnpruVWWjEBDZW8vQcFTCyWIcuA95vO5korto')" }}></div>
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">Agus Sport</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        Budi Santoso
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        19 Des 2025
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                        Rp 2.500.000
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700/50">
                                            Selesai
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="Lihat Detail">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 2 */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-sm font-mono text-brand-primary font-medium">
                                        #TRX-9927
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 bg-center bg-cover" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBCqzW94LamUg0EVwj6vOdTtlWWGHYCBgF4Df7V5vZA8VIIwW3fU6S0qk_Hoq3InI7gNnkp4o1lWUzXxDbx8WjBaxaNkmS5mUBgXiXwA0eHoKh7W3xoDiiA-4CiSRf9HU2PoQsIwaULrc0U9TzrPqi9_mJ1_UGKSxgfJ_ZzwrLV2hlG-KKW5KM_j43klFZmnCtA3FKJA8eW5-KYvm2dUG163tuNoegO2C_IauPlQxWLDhyEIAJYyyBAk-gSO5hlwLsomNl9vHmI9X4')" }}></div>
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">Alex M.</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        Siti Aminah
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        18 Des 2025
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                        Rp 850.000
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50">
                                            Proses
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="Lihat Detail">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                {/* Row 3 - Dispute */}
                                <tr className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors bg-red-50/50 dark:bg-red-900/10">
                                    <td className="px-6 py-4 text-sm font-mono text-red-500 font-medium">
                                        #TRX-9920
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 bg-center bg-cover" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBCqzW94LamUg0EVwj6vOdTtlWWGHYCBgF4Df7V5vZA8VIIwW3fU6S0qk_Hoq3InI7gNnkp4o1lWUzXxDbx8WjBaxaNkmS5mUBgXiXwA0eHoKh7W3xoDiiA-4CiSRf9HU2PoQsIwaULrc0U9TzrPqi9_mJ1_UGKSxgfJ_ZzwrLV2hlG-KKW5KM_j43klFZmnCtA3FKJA8eW5-KYvm2dUG163tuNoegO2C_IauPlQxWLDhyEIAJYyyBAk-gSO5hlwLsomNl9vHmI9X4')" }}></div>
                                            <span className="text-sm font-medium text-slate-900 dark:text-white">Alex M.</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                        John Doe
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        15 Des 2025
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                        Rp 1.500.000
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700/50 gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Dispute
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm shadow-red-500/25">
                                                Resolve
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-sm text-slate-500">
                            Menampilkan <span className="font-medium text-slate-900 dark:text-white">1-3</span> dari <span className="font-medium text-slate-900 dark:text-white">256</span> transaksi
                        </span>
                        <div className="flex gap-2">
                            <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
