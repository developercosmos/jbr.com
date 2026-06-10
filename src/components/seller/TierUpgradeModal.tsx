"use client";

import Link from "next/link";
import { CheckCircle2, ShieldCheck, X } from "lucide-react";
import { SellerBadge } from "@/components/seller/SellerBadges";

/**
 * Detects tier-gate errors thrown by server actions (T0 price gate, company-T2
 * publish gate, monthly cap) so forms can show the upgrade modal instead of a
 * plain inline error banner.
 */
export function isTierUpgradeError(message: string): boolean {
    return /naik ke tier T1|wajib melengkapi verifikasi T2|batas transaksi bulanan tier/i.test(message);
}

/** Keep only the core problem sentence; the how-to/bonus tail becomes bullets. */
function coreReason(message: string): string {
    for (const marker of [". Wajib", ". Ajukan", ". Seller dapat"]) {
        const idx = message.indexOf(marker);
        if (idx > 0) return message.slice(0, idx + 1);
    }
    return message;
}

/**
 * Popup dialog for "wajib upgrade tier" errors with a one-click path to the
 * KYC application (Pengaturan Toko → Verifikasi KYC Seller).
 */
export default function TierUpgradeModal({ message, onClose }: { message: string; onClose: () => void }) {
    const isCompanyT2 = /verifikasi T2/i.test(message);
    const benefits = isCompanyT2
        ? [
              "Toko bisnis aktif penuh — produk dapat diterbitkan",
              "Limit transaksi bulanan tier T2 (tertinggi)",
              "Payout tanpa batas tier T0",
          ]
        : [
              "Jual produk dengan harga lebih tinggi",
              "Limit transaksi bulanan naik (tier T1)",
              "Payout tanpa batas tier T0",
          ];

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

                {/* Inti masalah (satu kalimat dari server) */}
                <p className="text-sm text-slate-700 leading-relaxed rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    {coreReason(message)}
                </p>

                {/* Benefit upgrade */}
                <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-900">
                        Dengan melengkapi verifikasi {isCompanyT2 ? "T2 (KTP + selfie + dokumen bisnis)" : "T1 (KTP + selfie)"} Anda mendapat:
                    </p>
                    <ul className="space-y-1.5">
                        {benefits.map((b) => (
                            <li key={b} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span>{b}</span>
                            </li>
                        ))}
                        <li className="flex items-start gap-2 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span>
                                Lencana <strong>Seller Terverifikasi</strong> — menambah kepercayaan pembeli
                            </span>
                        </li>
                    </ul>
                </div>

                {/* Contoh visual lencana (komponen yang sama dengan yang dilihat pembeli) */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">Contoh lencana di toko & produk Anda:</span>
                    <SellerBadge type="verified" size="md" />
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
