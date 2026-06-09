"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, Loader2, ShieldCheck, ShieldX, X } from "lucide-react";
import { reviewSellerKycApplication } from "@/actions/kyc";

type KycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type KycTier = "T0" | "T1" | "T2";

interface FileRef {
    id: string;
    original_name: string;
    mime_type: string;
}

interface ScreeningResult {
    riskLevel: "low" | "medium" | "high";
    score: number;
    autoReject: boolean;
    flags: Array<{ code: string; severity: "low" | "medium" | "high"; message: string }>;
    ranAt: string;
}

interface Submission {
    userId: string;
    tier: KycTier;
    status: KycStatus;
    notes: string | null;
    nik: string | null;
    screening: ScreeningResult | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    seller: {
        id: string;
        name: string | null;
        email: string;
        store_name: string | null;
        store_slug: string | null;
        tier: KycTier;
    } | null;
    ktpFile: FileRef | null;
    selfieFile: FileRef | null;
    businessDocFile: FileRef | null;
    reviewer: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

interface Props {
    submissions: Submission[];
}

const STATUS_BADGE: Record<KycStatus, string> = {
    NOT_SUBMITTED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const RISK_BADGE: Record<string, string> = {
    low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    high: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};
const RISK_LABEL: Record<string, string> = { low: "Risiko Rendah", medium: "Risiko Sedang", high: "Risiko Tinggi" };
const FLAG_DOT: Record<string, string> = { low: "bg-slate-400", medium: "bg-amber-500", high: "bg-rose-500" };

function formatDate(iso: string | null): string {
    if (!iso) return "-";
    const date = new Date(iso);
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function KycReviewClient({ submissions }: Props) {
    const router = useRouter();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [preview, setPreview] = useState<FileRef | null>(null);

    // Close the preview modal on Escape.
    useEffect(() => {
        if (!preview) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPreview(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [preview]);

    function handleDecision(submission: Submission, decision: "APPROVED" | "REJECTED") {
        setError(null);
        setActiveId(submission.userId);
        const notes = decisionNotes[submission.userId]?.trim() || undefined;

        if (decision === "REJECTED" && !notes) {
            setError("Catatan penolakan wajib diisi agar seller mengetahui alasannya.");
            setActiveId(null);
            return;
        }

        startTransition(async () => {
            try {
                const approvedTier = decision === "APPROVED" && submission.tier !== "T0"
                    ? submission.tier
                    : undefined;
                await reviewSellerKycApplication({
                    sellerId: submission.userId,
                    decision,
                    approvedTier,
                    notes,
                });
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan keputusan KYC.");
            } finally {
                setActiveId(null);
            }
        });
    }

    if (submissions.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500 dark:text-slate-400">
                Tidak ada pengajuan dengan status ini.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-200">
                    {error}
                </div>
            )}

            {submissions.map((submission) => {
                const docs: Array<{ label: string; file: FileRef | null }> = [
                    { label: "KTP", file: submission.ktpFile },
                    { label: "Selfie", file: submission.selfieFile },
                    { label: "Dokumen Bisnis", file: submission.businessDocFile },
                ];

                return (
                    <div
                        key={submission.userId}
                        className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
                    >
                        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <div className="text-base font-bold text-slate-900 dark:text-white">
                                    {submission.seller?.store_name || submission.seller?.name || "Toko"}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {submission.seller?.email}
                                    {submission.seller?.store_slug && (
                                        <Link
                                            href={`/store/${submission.seller.store_slug}`}
                                            target="_blank"
                                            className="ml-2 text-brand-primary hover:underline inline-flex items-center gap-1"
                                        >
                                            kunjungi toko <ExternalLink className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Tier saat ini: {submission.seller?.tier ?? "T0"}
                                </span>
                                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
                                    Diajukan: {submission.tier}
                                </span>
                                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_BADGE[submission.status]}`}>
                                    {submission.status.replace("_", " ")}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                {docs.map((doc) => (
                                    <div
                                        key={doc.label}
                                        className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                {doc.label}
                                            </div>
                                            <div className="font-medium text-slate-900 dark:text-white truncate">
                                                {doc.file?.original_name ?? "Tidak diunggah"}
                                            </div>
                                        </div>
                                        {doc.file && (
                                            <button
                                                type="button"
                                                onClick={() => doc.file && setPreview(doc.file)}
                                                className="text-brand-primary hover:underline text-sm whitespace-nowrap inline-flex items-center gap-1"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> lihat
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                            Pra-screening Otomatis
                                        </span>
                                        {submission.screening ? (
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_BADGE[submission.screening.riskLevel] ?? RISK_BADGE.low}`}>
                                                {RISK_LABEL[submission.screening.riskLevel] ?? submission.screening.riskLevel} · skor {submission.screening.score}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400">Belum dijalankan (pengajuan lama)</span>
                                        )}
                                        {submission.screening?.autoReject && (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white">
                                                Ditolak otomatis
                                            </span>
                                        )}
                                    </div>
                                    {submission.nik && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            NIK: <span className="font-mono tracking-wider text-slate-900 dark:text-white">{submission.nik}</span>
                                        </span>
                                    )}
                                </div>
                                {submission.screening && submission.screening.flags.length > 0 ? (
                                    <ul className="space-y-1">
                                        {submission.screening.flags.map((flag, i) => (
                                            <li key={`${flag.code}-${i}`} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                                                <span className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${FLAG_DOT[flag.severity] ?? "bg-slate-400"}`} />
                                                <span>
                                                    <span className="font-mono text-slate-400">{flag.code}</span> — {flag.message}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : submission.screening ? (
                                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                                        Tidak ada temuan otomatis. Tetap lakukan verifikasi manual.
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <div>Diajukan: {formatDate(submission.submittedAt)}</div>
                                <div>Direview: {formatDate(submission.reviewedAt)}</div>
                                {submission.reviewer && (
                                    <div className="md:col-span-2">
                                        Reviewer: {submission.reviewer.name || submission.reviewer.email}
                                    </div>
                                )}
                                {submission.notes && (
                                    <div className="md:col-span-2">
                                        <span className="font-semibold">Catatan terakhir:</span> {submission.notes}
                                    </div>
                                )}
                            </div>

                            {submission.status === "PENDING_REVIEW" && (
                                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                                    <textarea
                                        rows={2}
                                        placeholder="Catatan untuk seller (wajib jika menolak)..."
                                        value={decisionNotes[submission.userId] ?? ""}
                                        onChange={(e) =>
                                            setDecisionNotes((prev) => ({
                                                ...prev,
                                                [submission.userId]: e.target.value,
                                            }))
                                        }
                                        className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
                                    />
                                    <div className="flex flex-wrap gap-2 justify-end">
                                        <button
                                            type="button"
                                            disabled={isPending && activeId === submission.userId}
                                            onClick={() => handleDecision(submission, "REJECTED")}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/20 text-sm font-semibold disabled:opacity-60"
                                        >
                                            {isPending && activeId === submission.userId ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ShieldX className="w-4 h-4" />
                                            )}
                                            Tolak
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isPending && activeId === submission.userId}
                                            onClick={() => handleDecision(submission, "APPROVED")}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-60"
                                        >
                                            {isPending && activeId === submission.userId ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <ShieldCheck className="w-4 h-4" />
                                            )}
                                            Setujui {submission.tier}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {preview && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    onClick={() => setPreview(null)}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white dark:bg-surface-dark shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 p-3">
                            <div className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">
                                {preview.original_name}
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={`/api/files/${preview.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                >
                                    Tab baru <ExternalLink className="h-3 w-3" />
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setPreview(null)}
                                    className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    aria-label="Tutup"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex min-h-[200px] flex-1 items-center justify-center overflow-auto bg-slate-50 dark:bg-black/40 p-2">
                            {preview.mime_type.startsWith("image/") ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={`/api/files/${preview.id}`}
                                    alt={preview.original_name}
                                    className="max-h-[76vh] w-auto object-contain"
                                />
                            ) : preview.mime_type === "application/pdf" ? (
                                <iframe
                                    src={`/api/files/${preview.id}`}
                                    title={preview.original_name}
                                    className="h-[76vh] w-full"
                                />
                            ) : (
                                <div className="p-8 text-center text-sm text-slate-500">
                                    Pratinjau tidak tersedia untuk tipe file ini.{" "}
                                    <a
                                        href={`/api/files/${preview.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand-primary hover:underline"
                                    >
                                        Unduh / buka di tab baru
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
