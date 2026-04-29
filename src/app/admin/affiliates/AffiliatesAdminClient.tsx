"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Banknote, Ban, CheckCircle2, XCircle } from "lucide-react";
import {
    approveAffiliateApplication,
    processAffiliatePayoutBatch,
    rejectAffiliateApplication,
    setAffiliateRateOverride,
    suspendAffiliate,
} from "@/actions/affiliate";

interface Account {
    userId: string;
    code: string;
    status: string;
    rateOverride: number | null;
    payoutMethod: string | null;
    payoutAccount: string | null;
    reviewNotes: string | null;
    reviewedAt: string | null;
    userName: string | null;
    userEmail: string | null;
}

interface Props {
    initial: Account[];
}

export default function AffiliatesAdminClient({ initial }: Props) {
    const router = useRouter();
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [revealedPayout, setRevealedPayout] = useState<Record<string, boolean>>({});
    const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
    const [info, setInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function maskPayoutAccount(value: string | null): string {
        if (!value) return "";
        if (value.length <= 4) return "*".repeat(value.length);
        return `${"*".repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
    }

    function handleSetRate(userId: string) {
        setError(null);
        const value = drafts[userId];
        const parsed = value === "" || value === undefined ? null : Number(value);
        if (parsed !== null && (Number.isNaN(parsed) || parsed < 0 || parsed > 100)) {
            setError("Rate harus antara 0 dan 100.");
            return;
        }
        startTransition(async () => {
            try {
                await setAffiliateRateOverride({ affiliateUserId: userId, rate: parsed });
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal update rate.");
            }
        });
    }

    function handleSuspend(userId: string) {
        if (!confirm("Suspend afiliasi ini? Klik baru tidak akan dilacak.")) return;
        startTransition(async () => {
            try {
                await suspendAffiliate(userId);
                router.refresh();
            } catch (err) {
                console.error(err);
            }
        });
    }

    function handleApprove(userId: string) {
        setError(null);
        startTransition(async () => {
            try {
                await approveAffiliateApplication(userId);
                setInfo("Pengajuan affiliate berhasil di-approve.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Approve affiliate gagal.");
            }
        });
    }

    function handleReject(userId: string) {
        const notes = decisionNotes[userId]?.trim() || "";
        if (!notes) {
            setError("Alasan reject affiliate wajib diisi.");
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                await rejectAffiliateApplication(userId, notes);
                setInfo("Pengajuan affiliate berhasil di-reject.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Reject affiliate gagal.");
            }
        });
    }

    function handlePayout() {
        setInfo(null);
        setError(null);
        startTransition(async () => {
            try {
                const result = await processAffiliatePayoutBatch();
                setInfo(
                    result.processed === 0
                        ? "Tidak ada komisi CLEARED untuk dibayarkan."
                        : `Batch payout: ${result.processed} entri, total Rp ${result.totalAmount.toLocaleString("id-ID")} ke ${result.lines.length} afiliasi.`
                );
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Payout gagal.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end">
                <button
                    type="button"
                    onClick={handlePayout}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Banknote className="w-4 h-4" /> Proses Batch Payout
                </button>
            </div>

            {error && <div className="text-sm text-rose-600">{error}</div>}
            {info && <div className="text-sm text-emerald-600">{info}</div>}

            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {initial.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Belum ada akun afiliasi.</div>
                    ) : (
                        initial.map((a) => (
                            <div key={a.userId} className="p-5 space-y-3">
                                <div className="flex flex-wrap items-center gap-3 justify-between">
                                <div className="space-y-1 text-sm">
                                    <div className="flex items-center gap-2">
                                        <strong className="font-mono">{a.code}</strong>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : a.status === "SUSPENDED" || a.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                                            {a.status}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        {a.userName ?? "—"} · {a.userEmail}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Payout: {a.payoutMethod ?? "—"} {revealedPayout[a.userId] ? (a.payoutAccount ?? "") : maskPayoutAccount(a.payoutAccount)}
                                        {a.payoutAccount && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRevealedPayout((prev) => ({
                                                        ...prev,
                                                        [a.userId]: !prev[a.userId],
                                                    }))
                                                }
                                                className="ml-2 text-[11px] font-semibold text-brand-primary hover:underline"
                                            >
                                                {revealedPayout[a.userId] ? "Sembunyikan" : "Tampilkan"}
                                            </button>
                                        )}
                                    </div>
                                    {a.reviewNotes && (
                                        <div className="text-xs text-slate-500">
                                            Catatan review: {a.reviewNotes}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="number"
                                        step="0.5"
                                        placeholder={a.rateOverride !== null ? String(a.rateOverride) : "default %"}
                                        value={drafts[a.userId] ?? ""}
                                        onChange={(e) =>
                                            setDrafts((prev) => ({ ...prev, [a.userId]: e.target.value }))
                                        }
                                        className="w-28 px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleSetRate(a.userId)}
                                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                                    >
                                        Set rate
                                    </button>
                                    {a.status === "PENDING" && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => handleApprove(a.userId)}
                                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                            >
                                                <CheckCircle2 className="w-3 h-3" /> Approve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReject(a.userId)}
                                                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50"
                                            >
                                                <XCircle className="w-3 h-3" /> Reject
                                            </button>
                                        </>
                                    )}
                                    {a.status === "ACTIVE" && (
                                        <button
                                            type="button"
                                            onClick={() => handleSuspend(a.userId)}
                                            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300"
                                        >
                                            <Ban className="w-3 h-3" /> Suspend
                                        </button>
                                    )}
                                </div>
                            </div>
                            {a.status === "PENDING" && (
                                <textarea
                                    rows={2}
                                    value={decisionNotes[a.userId] ?? ""}
                                    onChange={(e) =>
                                        setDecisionNotes((prev) => ({
                                            ...prev,
                                            [a.userId]: e.target.value,
                                        }))
                                    }
                                    placeholder="Tulis alasan reject jika pengajuan affiliate perlu diperbaiki."
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm"
                                />
                            )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
