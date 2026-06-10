"use client";

import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";

/**
 * Detects tier-gate errors thrown by server actions (T0 price gate, company-T2
 * publish gate, monthly cap) so forms can show the upgrade modal instead of a
 * plain inline error banner.
 */
export function isTierUpgradeError(message: string): boolean {
    return /naik ke tier T1|wajib melengkapi verifikasi T2|batas transaksi bulanan tier/i.test(message);
}

/**
 * Popup dialog for "wajib upgrade tier" errors with a one-click path to the
 * KYC application (Pengaturan Toko → Verifikasi KYC Seller).
 */
export default function TierUpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-full bg-amber-100">
                            <ShieldCheck className="w-6 h-6 text-amber-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">Perlu Upgrade Tier Seller</h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
                        aria-label="Tutup"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed">{message}</p>

                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700">
                    Bonus upgrade: lencana <strong>✓ Seller Terverifikasi</strong> tampil di toko & produk Anda —
                    menambah kepercayaan pembeli.
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Link
                        href="/seller/settings#kyc"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-blue-600 text-white text-sm font-bold transition-colors"
                    >
                        <ShieldCheck className="w-4 h-4" /> Ajukan KYC Sekarang
                    </Link>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
                    >
                        Nanti Saja
                    </button>
                </div>
            </div>
        </div>
    );
}
