"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
import {
    declareOmzetCrossedThreshold,
    declareOmzetUnderThreshold,
    saveSellerTaxProfile,
} from "@/actions/tax-profile";

interface TaxStatus {
    year: number;
    pph22Enabled: boolean;
    pph22Rate: number;
    threshold: number;
    ytdGross: number;
    overThreshold: boolean;
    withheldYtd: number;
    profile: {
        exists: boolean;
        taxIdKind: string | null;
        npwp: string | null;
        correspondenceAddress: string | null;
        pkp: boolean;
        declarationActive: boolean;
        declaredAt: string | null;
        crossedDeclared: boolean;
        crossedDeclaredAt: string | null;
    };
    kycNikMasked: string | null;
}

function rupiah(n: number) {
    return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}

export default function TaxPmk37Card({ status }: { status: TaxStatus }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [taxIdKind, setTaxIdKind] = useState<"NPWP" | "NIK">(
        (status.profile.taxIdKind as "NPWP" | "NIK") ?? (status.kycNikMasked ? "NIK" : "NPWP")
    );
    const [npwp, setNpwp] = useState(status.profile.npwp ?? "");
    const [address, setAddress] = useState(status.profile.correspondenceAddress ?? "");

    function run(fn: () => Promise<unknown>, okMsg: string) {
        setError(null);
        setInfo(null);
        startTransition(async () => {
            try {
                await fn();
                setInfo(okMsg);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal memproses.");
            }
        });
    }

    const pct = Math.min(100, Math.round((status.ytdGross / Math.max(status.threshold, 1)) * 100));

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div>
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Landmark className="w-4 h-4" /> Pajak (PMK 37/2025)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                    Marketplace yang ditunjuk DJP memungut PPh Pasal 22 sebesar {status.pph22Rate * 100}% dari peredaran
                    bruto. Orang pribadi dengan omzet ≤ {rupiah(status.threshold)}/tahun <strong>tidak dipungut</strong>{" "}
                    bila sudah menyampaikan surat pernyataan. Status pemungutan platform saat ini:{" "}
                    {status.pph22Enabled ? (
                        <span className="font-semibold text-emerald-600">AKTIF</span>
                    ) : (
                        <span className="font-semibold text-slate-500">BELUM AKTIF (belum ditunjuk DJP)</span>
                    )}
                    .
                </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-900 dark:text-white">Omzet (peredaran bruto) {status.year}</span>
                    <span className="text-slate-600 dark:text-slate-300">
                        {rupiah(status.ytdGross)} / ambang {rupiah(status.threshold)}
                    </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                        className={`h-full ${status.overThreshold ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                    <span>PPh 22 dipungut tahun ini: <strong className="text-slate-900 dark:text-white">{rupiah(status.withheldYtd)}</strong></span>
                    <span>
                        Status:{" "}
                        {status.profile.crossedDeclared
                            ? "Dipungut (omzet melewati ambang — mulai bulan setelah pelaporan)"
                            : status.profile.declarationActive
                                ? "Tidak dipungut (pernyataan ≤ ambang aktif)"
                                : status.pph22Enabled
                                    ? "Dipungut (belum ada pernyataan ≤ ambang)"
                                    : "Tidak ada pemungutan"}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Identitas pajak</p>
                    <div className="flex gap-2">
                        {(["NPWP", "NIK"] as const).map((kind) => (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => setTaxIdKind(kind)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${taxIdKind === kind ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"}`}
                            >
                                {kind}
                            </button>
                        ))}
                    </div>
                    {taxIdKind === "NPWP" ? (
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={16}
                            value={npwp}
                            onChange={(e) => setNpwp(e.target.value.replace(/\D/g, ""))}
                            placeholder="15–16 digit NPWP"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm"
                        />
                    ) : (
                        <p className="text-xs text-slate-500">
                            {status.kycNikMasked
                                ? `Menggunakan NIK dari KYC: ${status.kycNikMasked}`
                                : "NIK belum tersedia — lengkapi KYC (KTP) di Pengaturan Toko, atau pilih NPWP."}
                        </p>
                    )}
                    <textarea
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Alamat korespondensi (wajib PMK 37/2025)"
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm resize-none"
                    />
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                            run(
                                () => saveSellerTaxProfile({ taxIdKind, npwp: npwp || undefined, correspondenceAddress: address }),
                                "Identitas pajak tersimpan."
                            )
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-primary hover:bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />} Simpan Identitas Pajak
                    </button>
                </div>

                <div className="space-y-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Pernyataan omzet</p>
                    {status.profile.declarationActive ? (
                        <p className="text-xs text-emerald-600">
                            ✓ Surat pernyataan omzet ≤ {rupiah(status.threshold)} untuk {status.year} sudah disampaikan
                            {status.profile.declaredAt ? ` (${new Date(status.profile.declaredAt).toLocaleDateString("id-ID")})` : ""}.
                        </p>
                    ) : (
                        <button
                            type="button"
                            disabled={isPending || status.overThreshold}
                            onClick={() => run(() => declareOmzetUnderThreshold(), "Pernyataan omzet ≤ ambang tersimpan.")}
                            className="w-full px-4 py-2 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold disabled:opacity-50"
                        >
                            Sampaikan Pernyataan Omzet ≤ {rupiah(status.threshold)} ({status.year})
                        </button>
                    )}
                    {status.overThreshold && !status.profile.crossedDeclared && (
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={() => run(() => declareOmzetCrossedThreshold(), "Pelaporan omzet melewati ambang tersimpan.")}
                            className="w-full px-4 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-semibold disabled:opacity-50"
                        >
                            Lapor: Omzet {status.year} Melewati {rupiah(status.threshold)}
                        </button>
                    )}
                    {status.profile.crossedDeclared && (
                        <p className="text-xs text-amber-600">
                            ✓ Pelaporan omzet melewati ambang sudah disampaikan — pemungutan PPh 22 berjalan mulai awal
                            bulan berikutnya setelah pelaporan.
                        </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                        Simpan riwayat transaksi & total omzet per tahun. Dokumen tagihan marketplace dipersamakan dengan
                        bukti pemungutan PPh 22. PPN baru relevan bila Anda berstatus PKP (omzet &gt; Rp4,8 miliar/tahun).
                    </p>
                </div>
            </div>

            {error && <div className="text-sm text-rose-600">{error}</div>}
            {info && <div className="text-sm text-emerald-600">{info}</div>}
        </div>
    );
}
