"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy, Check, Banknote } from "lucide-react";
import { enrollAffiliate } from "@/actions/affiliate";

interface DashboardData {
    account: {
        code: string;
        status: string;
        payoutMethod: string | null;
        payoutAccount: string | null;
    } | null;
    totals: { clicks: number; conversions: number; pending: number; cleared: number; reversed: number };
    attributions: Array<{
        id: string;
        orderId: string;
        commission: number;
        rate: number;
        status: string;
        createdAt: string;
    }>;
}

interface Props {
    initial: DashboardData;
    baseUrl: string;
}

export default function AffiliateDashboardClient({ initial, baseUrl }: Props) {
    const router = useRouter();
    const [data] = useState(initial);
    const [payoutMethod, setPayoutMethod] = useState("");
    const [payoutAccount, setPayoutAccount] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleEnroll() {
        setError(null);
        startTransition(async () => {
            try {
                await enrollAffiliate({
                    payoutMethod: payoutMethod.trim() || undefined,
                    payoutAccount: payoutAccount.trim() || undefined,
                });
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mendaftar afiliasi.");
            }
        });
    }

    function handleCopy(link: string) {
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    }

    if (!data.account) {
        return (
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Daftar sebagai Affiliate</h2>
                <p className="text-sm text-slate-500">
                    Setelah daftar, Anda mendapat link unik dan komisi default dari setiap pesanan yang completed via
                    link Anda. Self-purchase tidak dihitung.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Metode Payout (opsional)</label>
                        <input
                            type="text"
                            placeholder="BCA / GoPay / OVO / Dana"
                            value={payoutMethod}
                            onChange={(e) => setPayoutMethod(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Nomor / Akun (opsional)</label>
                        <input
                            type="text"
                            value={payoutAccount}
                            onChange={(e) => setPayoutAccount(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                </div>
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <button
                    type="button"
                    onClick={handleEnroll}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Daftar Sekarang
                </button>
            </div>
        );
    }

    const link = `${baseUrl}?ref=${data.account.code}`;

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2">
                <div className="text-xs uppercase tracking-wide text-slate-500">Link Anda</div>
                <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-slate-50 dark:bg-black/20 px-3 py-2 rounded-lg break-all">{link}</code>
                    <button
                        type="button"
                        onClick={() => handleCopy(link)}
                        className="inline-flex items-center gap-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Tersalin" : "Salin"}
                    </button>
                </div>
                <div className="text-xs text-slate-500">
                    Kode: <strong>{data.account.code}</strong> · Status:{" "}
                    <span className={data.account.status === "ACTIVE" ? "text-emerald-600" : "text-rose-600"}>
                        {data.account.status}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Stat label="Klik" value={data.totals.clicks} />
                <Stat label="Konversi" value={data.totals.conversions} />
                <Stat label="Pending" value={`Rp ${data.totals.pending.toLocaleString("id-ID")}`} />
                <Stat label="Cleared" value={`Rp ${data.totals.cleared.toLocaleString("id-ID")}`} highlight />
                <Stat label="Reversed" value={`Rp ${data.totals.reversed.toLocaleString("id-ID")}`} />
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-brand-primary" />
                    <h3 className="font-bold">Atribusi Terbaru</h3>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {data.attributions.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Belum ada konversi.</div>
                    ) : (
                        data.attributions.map((a) => (
                            <div key={a.id} className="p-4 text-sm flex items-start justify-between">
                                <div>
                                    <div className="font-mono text-xs text-slate-500">Order {a.orderId.slice(0, 8)}</div>
                                    <div className="text-xs text-slate-500">
                                        {new Date(a.createdAt).toLocaleString("id-ID")} · rate {a.rate}%
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold">Rp {a.commission.toLocaleString("id-ID")}</div>
                                    <div className={`text-xs ${a.status === "CLEARED" ? "text-emerald-600" : a.status === "REVERSED" ? "text-rose-600" : "text-amber-600"}`}>
                                        {a.status}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-3">
            <div className="text-xs text-slate-500">{label}</div>
            <div className={`text-lg font-bold ${highlight ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}>
                {value}
            </div>
        </div>
    );
}
