import { Search, Filter, MessageSquare, AlertCircle, CheckCircle, XCircle } from "lucide-react";

export default function AdminDisputesPage() {
    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Pusat Resolusi
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Tangani komplain dan sengketa transaksi antara penjual dan pembeli.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <button className="px-4 py-2 rounded-full bg-brand-primary text-white text-sm font-bold whitespace-nowrap shadow-md shadow-brand-primary/25">
                        Semua Kasus
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                        Perlu Tindakan
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                        Menunggu Respon
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                        Selesai
                    </button>
                </div>

                {/* Disputes List */}
                <div className="space-y-4">
                    {/* Dispute Card 1 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700/50 uppercase tracking-wide flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        High Priority
                                    </span>
                                    <span className="text-sm text-slate-500">#DSP-2025-001</span>
                                    <span className="text-sm text-slate-400">•</span>
                                    <span className="text-sm text-slate-500">2 jam yang lalu</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        Barang tidak sesuai deskripsi
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                        Pembeli menerima raket dengan senar putus, padahal di deskripsi tertulis kondisi baru dan siap pakai. Penjual menolak retur.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Pelapor:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">Budi Santoso</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Terlapor:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">Agus Sport Store</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Nilai:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">Rp 2.500.000</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center gap-2 min-w-[140px]">
                                <button className="w-full px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
                                    Lihat Detail
                                </button>
                                <button className="w-full px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                    Hubungi User
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dispute Card 2 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                                <div className="flex items-center gap-3">
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50 uppercase tracking-wide flex items-center gap-1">
                                        <MessageSquare className="w-3 h-3" />
                                        Diskusi
                                    </span>
                                    <span className="text-sm text-slate-500">#DSP-2025-002</span>
                                    <span className="text-sm text-slate-400">•</span>
                                    <span className="text-sm text-slate-500">1 hari yang lalu</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                        Paket belum sampai
                                    </h3>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
                                        Status pengiriman sudah "Diterima" tapi pembeli belum menerima paket. Kurir tidak bisa dihubungi.
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Pelapor:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">Siti Aminah</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Terlapor:</span>
                                        <span className="font-medium text-slate-900 dark:text-white">Pro Shop Indonesia</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-500">Nilai:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">Rp 850.000</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-center gap-2 min-w-[140px]">
                                <button className="w-full px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
                                    Lihat Detail
                                </button>
                                <button className="w-full px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                    Hubungi User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
