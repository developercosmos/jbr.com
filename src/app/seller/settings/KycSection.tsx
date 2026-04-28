"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { ShieldCheck, Upload, FileCheck2, AlertCircle, Loader2 } from "lucide-react";
import { submitSellerKycApplication, uploadKycDocument } from "@/actions/kyc";

type KycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type KycTier = "T0" | "T1" | "T2";

interface KycProfile {
    tier: KycTier;
    status: KycStatus;
    notes: string | null;
    submitted_at: Date | null;
    reviewed_at: Date | null;
    ktp_file_id: string | null;
    selfie_file_id: string | null;
    business_doc_file_id: string | null;
}

interface KycSectionProps {
    profile: KycProfile | null;
    currentTier: KycTier;
}

type SlotKey = "ktp" | "selfie" | "business";

const slotMeta: Record<SlotKey, { label: string; help: string }> = {
    ktp: { label: "Foto KTP", help: "Pastikan KTP terlihat jelas dan tidak terpotong." },
    selfie: { label: "Selfie dengan KTP", help: "Wajah dan KTP harus terlihat dalam satu frame." },
    business: { label: "Dokumen Bisnis (NIB / SIUP)", help: "Wajib untuk pengajuan T2." },
};

const STATUS_BADGE: Record<KycStatus, { label: string; className: string }> = {
    NOT_SUBMITTED: { label: "Belum Diajukan", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
    PENDING_REVIEW: { label: "Menunggu Review", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    APPROVED: { label: "Disetujui", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    REJECTED: { label: "Ditolak", className: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

export default function KycSection({ profile, currentTier }: KycSectionProps) {
    const [targetTier, setTargetTier] = useState<"T1" | "T2">("T1");
    const [notes, setNotes] = useState(profile?.notes ?? "");
    const [fileIds, setFileIds] = useState<Record<SlotKey, string | null>>({
        ktp: profile?.ktp_file_id ?? null,
        selfie: profile?.selfie_file_id ?? null,
        business: profile?.business_doc_file_id ?? null,
    });
    const [uploadingSlot, setUploadingSlot] = useState<SlotKey | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const status: KycStatus = profile?.status ?? "NOT_SUBMITTED";
    const isLocked = status === "PENDING_REVIEW";
    const badge = STATUS_BADGE[status];

    async function handleUpload(slot: SlotKey, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        setError(null);
        setSuccess(null);
        setUploadingSlot(slot);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("slot", slot);
            const result = await uploadKycDocument(formData);
            setFileIds((prev) => ({ ...prev, [slot]: result.fileId }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mengunggah dokumen.");
        } finally {
            setUploadingSlot(null);
            event.target.value = "";
        }
    }

    function handleSubmit() {
        setError(null);
        setSuccess(null);

        if (!fileIds.ktp || !fileIds.selfie) {
            setError("KTP dan selfie wajib diunggah sebelum mengirim pengajuan.");
            return;
        }
        if (targetTier === "T2" && !fileIds.business) {
            setError("Dokumen bisnis wajib untuk pengajuan tier T2.");
            return;
        }

        startTransition(async () => {
            try {
                await submitSellerKycApplication({
                    targetTier,
                    ktpFileId: fileIds.ktp!,
                    selfieFileId: fileIds.selfie!,
                    businessDocFileId: fileIds.business || undefined,
                    notes: notes.trim() || undefined,
                });
                setSuccess("Pengajuan KYC berhasil dikirim. Menunggu review admin.");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengirim pengajuan KYC.");
            }
        });
    }

    return (
        <div id="kyc" className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden scroll-mt-24">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-primary" />
                    Verifikasi KYC Seller
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                        Tier saat ini: <span className="text-slate-900 dark:text-white">{currentTier}</span>
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                        {badge.label}
                    </span>
                </div>
            </div>
            <div className="p-6 space-y-6">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Naikkan tier akun Anda untuk meningkatkan batas transaksi bulanan dan mendapat lencana
                    verifikasi pada halaman toko. Dokumen Anda hanya dapat diakses oleh admin yang melakukan review.
                </p>

                {profile?.notes && status === "REJECTED" && (
                    <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-700 dark:text-rose-200 flex gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <div className="font-semibold mb-1">Catatan Reviewer</div>
                            <div>{profile.notes}</div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Tier yang Diajukan
                    </label>
                    <div className="flex gap-3">
                        {(["T1", "T2"] as const).map((tier) => (
                            <button
                                key={tier}
                                type="button"
                                disabled={isLocked}
                                onClick={() => setTargetTier(tier)}
                                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-semibold transition ${
                                    targetTier === tier
                                        ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                        : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-primary/50"
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {tier === "T1" ? "T1 — Identitas Terverifikasi" : "T2 — Bisnis Terverifikasi"}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.keys(slotMeta) as SlotKey[]).map((slot) => {
                        const stored = fileIds[slot];
                        const required = slot === "business" ? targetTier === "T2" : true;
                        const meta = slotMeta[slot];
                        return (
                            <div
                                key={slot}
                                className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                            >
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                        {meta.label}
                                        {required && <span className="text-rose-500 ml-1">*</span>}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{meta.help}</div>
                                </div>
                                <label
                                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed text-sm cursor-pointer transition ${
                                        stored
                                            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300"
                                            : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-primary/50"
                                    } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                    {uploadingSlot === slot ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" /> Mengunggah...
                                        </>
                                    ) : stored ? (
                                        <>
                                            <FileCheck2 className="w-4 h-4" />
                                            {profile && profile[`${slot === "business" ? "business_doc" : slot}_file_id` as keyof KycProfile] === stored
                                                ? "Sudah tersimpan"
                                                : "Berkas siap dikirim"}
                                        </>
                                    ) : (
                                        <>
                                            <Upload className="w-4 h-4" /> Pilih berkas (JPG/PNG/PDF)
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp,application/pdf"
                                        className="hidden"
                                        disabled={isLocked || uploadingSlot !== null}
                                        onChange={(e) => handleUpload(slot, e)}
                                    />
                                </label>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Catatan untuk Reviewer (opsional)
                    </label>
                    <textarea
                        rows={3}
                        value={notes}
                        disabled={isLocked}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Misal: nomor kontak alternatif, alamat usaha, dll."
                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm resize-none disabled:opacity-60"
                    />
                </div>

                {error && (
                    <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-200">
                        {error}
                    </div>
                )}
                {success && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                        {success}
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isLocked || isPending || uploadingSlot !== null}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-primary hover:bg-blue-600 text-white rounded-lg font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isLocked ? "Menunggu Review" : "Kirim Pengajuan KYC"}
                    </button>
                </div>
            </div>
        </div>
    );
}
