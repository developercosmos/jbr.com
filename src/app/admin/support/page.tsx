import { Search, MessageCircle, Mail, Phone, CheckCircle, Clock } from "lucide-react";

export default function AdminSupportPage() {
    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Support Tickets
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola pertanyaan dan bantuan untuk pengguna.
                        </p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                    <button className="px-4 py-2 rounded-full bg-brand-primary text-white text-sm font-bold whitespace-nowrap shadow-md shadow-brand-primary/25">
                        Open (5)
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                        Pending (2)
                    </button>
                    <button className="px-4 py-2 rounded-full bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 text-sm font-medium whitespace-nowrap transition-colors">
                        Closed (128)
                    </button>
                </div>

                {/* Tickets List */}
                <div className="space-y-4">
                    {/* Ticket 1 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                                    <MessageCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                        Bagaimana cara mengganti nomor rekening?
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-2">
                                        User: Budi Santoso • 15 menit yang lalu
                                    </p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        Account Issue
                                    </span>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700/50 uppercase tracking-wide">
                                New
                            </span>
                        </div>
                    </div>

                    {/* Ticket 2 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 flex-shrink-0">
                                    <Mail className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                        Verifikasi KTP gagal terus
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-2">
                                        User: Siti Aminah • 1 jam yang lalu
                                    </p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        Verification
                                    </span>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50 uppercase tracking-wide">
                                Pending
                            </span>
                        </div>
                    </div>

                    {/* Ticket 3 */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer opacity-75 hover:opacity-100">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 flex-shrink-0">
                                    <CheckCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                                        Lupa password akun
                                    </h3>
                                    <p className="text-slate-500 text-sm mb-2">
                                        User: Ahmad Dhani • 1 hari yang lalu
                                    </p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                        Security
                                    </span>
                                </div>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 uppercase tracking-wide">
                                Closed
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
