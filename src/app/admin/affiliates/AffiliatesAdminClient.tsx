"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Banknote, Ban, CheckCircle2, ExternalLink, ScanText, XCircle } from "lucide-react";
import {
    approveAffiliateApplication,
    processAffiliatePayoutBatch,
    rejectAffiliateApplication,
    setAffiliateRateOverride,
    suspendAffiliate,
} from "@/actions/affiliate";
import { runAffiliateOcrForUser } from "@/actions/kyc-ocr";

// SECURITY: legacy ktp_url/statement_url are free-text columns that predate URL
// validation; an attacker-controlled "javascript:..." value would run in the ADMIN
// origin on click. Only emit https / same-origin upload paths as a real href.
function safeHttpHref(u: string | null | undefined): string {
    if (!u) return "#";
    if (/^https:\/\//i.test(u) || u.startsWith("/api/files/") || u.startsWith("/uploads/")) return u;
    return "#";
}

interface OcrResult {
    status: "PENDING" | "DONE" | "FAILED" | "SKIPPED";
    attempts: number;
    isKtp: boolean | null;
    extracted: { nik: string | null; nama: string | null; ttl: string | null } | null;
    checks: { nikVerdict: "match" | "near" | "mismatch" | "unreadable"; nikDistance: number | null } | null;
    model: string | null;
    error: string | null;
    ranAt: string | null;
}

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
    fullName: string | null;
    nik: string | null;
    ktpFileId: string | null;
    ktpUrl: string | null;
    statementFileId: string | null;
    statementUrl: string | null;
    ocr: OcrResult | null;
}

interface Props {
    initial: Account[];
    ocrConfigured: boolean;
}

const OCR_VERDICT: Record<string, { label: string; className: string }> = {
    match: { label: "NIK cocok dengan kartu", className: "bg-emerald-100 text-emerald-700" },
    near: { label: "NIK mirip (kemungkinan noise OCR)", className: "bg-amber-100 text-amber-700" },
    mismatch: { label: "NIK BERBEDA dari kartu", className: "bg-rose-100 text-rose-700" },
    unreadable: { label: "NIK tak terbaca dari kartu", className: "bg-slate-100 text-slate-600" },
};

export default function AffiliatesAdminClient({ initial, ocrConfigured }: Props) {
    const router = useRouter();
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [revealedPayout, setRevealedPayout] = useState<Record<string, boolean>>({});
    const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
    const [info, setInfo] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const [ocrRunningId, setOcrRunningId] = useState<string | null>(null);

    async function handleRunOcr(userId: string) {
        setError(null);
        setOcrRunningId(userId);
        try {
            const res = await runAffiliateOcrForUser(userId);
            if (res && "success" in res && res.success === false) {
                setError(res.error || "Gagal menjalankan OCR.");
                return;
            }
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal menjalankan OCR.");
        } finally {
            setOcrRunningId(null);
        }
    }

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
                const res = await setAffiliateRateOverride({ affiliateUserId: userId, rate: parsed });
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal mengatur rate.");
                    return;
                }
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
                const res = await approveAffiliateApplication(userId);
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal menyetujui affiliate.");
                    return;
                }
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
                const res = await rejectAffiliateApplication(userId, notes);
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal menolak affiliate.");
                    return;
                }
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
                if (result && "success" in result && result.success === false) {
                    setError(result.error || "Gagal memproses payout.");
                    return;
                }
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

                            {(a.ktpFileId || a.ktpUrl || a.nik) && (
                                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="font-semibold uppercase tracking-wide text-slate-500 inline-flex items-center gap-1">
                                                <ScanText className="w-3.5 h-3.5" /> KTP &amp; OCR
                                            </span>
                                            {a.ktpFileId ? (
                                                <a
                                                    href={`/api/files/${a.ktpFileId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                                                >
                                                    Lihat KTP <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : a.ktpUrl ? (
                                                <a
                                                    href={safeHttpHref(a.ktpUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-amber-600 hover:underline"
                                                    title="Upload lama: tersimpan sebagai URL publik"
                                                >
                                                    Lihat KTP (upload lama) <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : (
                                                <span className="text-slate-400">KTP belum diunggah</span>
                                            )}
                                            {a.statementFileId ? (
                                                <a
                                                    href={`/api/files/${a.statementFileId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                                                >
                                                    Surat Pernyataan <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : a.statementUrl ? (
                                                <a
                                                    href={safeHttpHref(a.statementUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-amber-600 hover:underline"
                                                    title="Upload lama: tersimpan sebagai URL publik"
                                                >
                                                    Surat Pernyataan (lama) <ExternalLink className="w-3 h-3" />
                                                </a>
                                            ) : null}
                                            {a.nik && (
                                                <span className="text-slate-500">
                                                    NIK diketik: <span className="font-mono tracking-wider text-slate-900 dark:text-white">{a.nik}</span>
                                                </span>
                                            )}
                                        </div>
                                        {ocrConfigured && a.ktpFileId && (
                                            <button
                                                type="button"
                                                onClick={() => handleRunOcr(a.userId)}
                                                disabled={ocrRunningId === a.userId}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-brand-primary/50 disabled:opacity-60"
                                            >
                                                {ocrRunningId === a.userId ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <ScanText className="w-3.5 h-3.5" />
                                                )}
                                                {a.ocr?.status === "DONE" || a.ocr?.status === "FAILED" ? "Jalankan ulang OCR" : "Jalankan OCR"}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        {a.ocr?.status === "DONE" && a.ocr.checks && (
                                            <span className={`font-semibold px-2 py-0.5 rounded-full ${OCR_VERDICT[a.ocr.checks.nikVerdict]?.className ?? ""}`}>
                                                {OCR_VERDICT[a.ocr.checks.nikVerdict]?.label ?? a.ocr.checks.nikVerdict}
                                            </span>
                                        )}
                                        {a.ocr?.status === "DONE" && a.ocr.isKtp === false && (
                                            <span className="font-semibold px-2 py-0.5 rounded-full bg-rose-600 text-white">Bukan KTP</span>
                                        )}
                                        {a.ocr?.status === "PENDING" && <span className="text-amber-600">OCR: menunggu diproses…</span>}
                                        {a.ocr?.status === "FAILED" && (
                                            <span className="text-rose-600">OCR gagal{a.ocr.error ? `: ${a.ocr.error}` : ""}</span>
                                        )}
                                        {!a.ocr && <span className="text-slate-400">OCR belum dijalankan</span>}
                                    </div>
                                    {a.ocr?.status === "DONE" && a.ocr.extracted && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <span className="text-slate-400">NIK (kartu):</span>{" "}
                                                <span className="font-mono text-slate-900 dark:text-white">{a.ocr.extracted.nik ?? "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">Nama (kartu):</span>{" "}
                                                <span className="text-slate-900 dark:text-white">{a.ocr.extracted.nama ?? "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-400">TTL (kartu):</span>{" "}
                                                <span className="text-slate-900 dark:text-white">{a.ocr.extracted.ttl ?? "—"}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-[11px] text-slate-400">
                                        OCR bersifat advisory — verifikasi akhir tetap manual oleh admin.
                                    </div>
                                </div>
                            )}
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
