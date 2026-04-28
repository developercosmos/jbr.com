import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
    getAffiliateLedgerHistory,
    getAffiliateLedgerSummary,
} from "@/actions/accounting/affiliate-ledger";

export const dynamic = "force-dynamic";

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function AffiliateLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string }>;
}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?redirect=/affiliate/ledger");
    const sp = await searchParams;
    const year = Number(sp.year) || new Date().getUTCFullYear();
    const summary = await getAffiliateLedgerSummary(session.user.id, year);
    const history = await getAffiliateLedgerHistory(session.user.id, 100);

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <Link href="/affiliate" className="text-sm text-brand-primary hover:underline">
                        ← Dashboard Affiliate
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                        Wallet & Riwayat Komisi
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Detail saldo wallet komisi Anda dan riwayat akrual / payment / clawback dari general ledger.
                        Semua angka berasal dari jurnal POSTED.
                    </p>
                </header>

                <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="Saldo Wallet (terutang)" value={fmtIDR(summary.walletBalance)} highlight />
                    <Stat label={`YTD Diakumulasi ${year}`} value={fmtIDR(summary.ytdAccrued)} />
                    <Stat label={`YTD Dibayarkan ${year}`} value={fmtIDR(summary.ytdPaid)} />
                    <Stat label={`YTD Clawback ${year}`} value={fmtIDR(summary.ytdReversed)} amber />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
                    <div className="font-semibold text-slate-900 mb-2">PPh dipotong YTD {year}</div>
                    <div className="grid grid-cols-3 gap-3 text-center text-xs">
                        <TaxRow label="PPh 21" value={fmtIDR(summary.ytdWithheldPph21)} />
                        <TaxRow label="PPh 23" value={fmtIDR(summary.ytdWithheldPph23)} />
                        <TaxRow label="PPh 4(2) Final" value={fmtIDR(summary.ytdWithheldPph42)} />
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 text-right">
                        Total: <b className="font-mono">Rp {fmtIDR(summary.ytdWithheldTotal)}</b>
                    </div>
                </div>

                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-2">Riwayat Mutasi (100 terakhir)</h2>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                                <tr>
                                    <th className="px-3 py-2 text-left">Tanggal</th>
                                    <th className="px-3 py-2 text-left">Keterangan</th>
                                    <th className="px-3 py-2 text-right">Debit</th>
                                    <th className="px-3 py-2 text-right">Kredit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.length === 0 ? (
                                    <tr><td className="px-3 py-6 text-slate-500" colSpan={4}>Belum ada mutasi komisi.</td></tr>
                                ) : history.map((h) => (
                                    <tr key={h.journalId + h.accountCode} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-xs">{new Date(h.postedAt).toLocaleString("id-ID")}</td>
                                        <td className="px-3 py-2">
                                            <div className="font-medium text-slate-900">{h.description}</div>
                                            <div className="text-xs text-slate-500">{h.accountCode} {h.accountName}</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">{h.debit ? fmtIDR(h.debit) : ""}</td>
                                        <td className="px-3 py-2 text-right font-mono text-emerald-700">{h.credit ? fmtIDR(h.credit) : ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <b>Catatan:</b> Saldo wallet menampilkan jumlah komisi yang sudah CLEARED dan belum
                    dibayarkan. Pembayaran dilakukan dalam batch oleh admin. Bukti potong PPh PDF akan
                    tersedia setelah modul export PDF di-deploy.
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight, amber }: { label: string; value: string; highlight?: boolean; amber?: boolean }) {
    const cls = highlight
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : amber
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-white text-slate-900";
    return (
        <div className={`rounded-xl border p-4 ${cls}`}>
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className="mt-1 font-mono font-bold">Rp {value}</div>
        </div>
    );
}

function TaxRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-slate-500">{label}</div>
            <div className="mt-1 font-mono font-medium text-slate-900">Rp {value}</div>
        </div>
    );
}
