"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, ShieldCheck, ShieldX } from "lucide-react";
import { reviewSellerKycApplication } from "@/actions/kyc";

type KycStatus = "NOT_SUBMITTED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
type KycTier = "T0" | "T1" | "T2";

interface FileRef {
    id: string;
    original_name: string;
    mime_type: string;
}

interface Submission {
    userId: string;
    tier: KycTier;
    status: KycStatus;
    notes: string | null;
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
                                            <Link
                                                href={`/api/files/${doc.file.id}`}
                                                target="_blank"
                                                className="text-brand-primary hover:underline text-sm whitespace-nowrap inline-flex items-center gap-1"
                                            >
                                                lihat <ExternalLink className="w-3 h-3" />
                                            </Link>
                                        )}
                                    </div>
                                ))}
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
        </div>
    );
}
