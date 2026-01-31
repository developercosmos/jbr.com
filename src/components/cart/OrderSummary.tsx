import { Tag, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function OrderSummary() {
    return (
        <div className="w-full lg:w-[380px] flex-shrink-0 lg:sticky lg:top-24 h-fit">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700/50 flex flex-col gap-5">
                <h3 className="text-slate-900 dark:text-white text-lg font-bold">
                    Ringkasan Belanja
                </h3>
                {/* Coupon Input */}
                <div className="flex gap-2">
                    <div className="flex items-center gap-2 flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-[#1e293b]">
                        <Tag className="w-5 h-5 text-brand-primary" />
                        <input
                            className="bg-transparent border-none p-0 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-0 w-full outline-none"
                            placeholder="Kode Promo"
                            type="text"
                        />
                    </div>
                    <button className="text-sm font-semibold text-brand-primary hover:text-blue-400 px-2">
                        Gunakan
                    </button>
                </div>
                <hr className="border-slate-200 dark:border-slate-700" />
                {/* Price Breakdown */}
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                        <span>Total Harga (1 Barang)</span>
                        <span>Rp 1.200.000</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-slate-600 dark:text-slate-400">
                        <span>Total Diskon Barang</span>
                        <span className="text-slate-900 dark:text-white font-medium">
                            -Rp 0
                        </span>
                    </div>
                </div>
                <hr className="border-slate-200 dark:border-slate-700" />
                <div className="flex justify-between items-end">
                    <span className="text-base font-bold text-slate-900 dark:text-white">
                        Total Harga
                    </span>
                    <span className="text-xl font-bold text-brand-primary">
                        Rp 1.200.000
                    </span>
                </div>
                {/* CTA Button */}
                <Link href="/checkout">
                    <button className="w-full bg-brand-primary hover:bg-brand-primary-dark text-white font-bold py-3.5 rounded-lg shadow-lg shadow-brand-primary/30 transition-all active:scale-[0.98] flex justify-center items-center gap-2 mt-2">
                        Beli (1)
                    </button>
                </Link>
                {/* Trust Badge */}
                <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-500 text-xs mt-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Jaminan Aman & Terpercaya</span>
                </div>
            </div>
        </div>
    );
}
