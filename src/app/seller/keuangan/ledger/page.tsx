import Link from "next/link";
import { requireSellerFinanceSession } from "@/lib/seller-finance";
import {
    getSellerLedgerHistory,
    getSellerLedgerSummary,
} from "@/actions/accounting/seller-ledger";

export const dynamic = "force-dynamic";

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function SellerLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string }>;
}) {
    const session = await requireSellerFinanceSession({ redirectTo: "/seller/keuangan/ledger" });
    const sp = await searchParams;
    const year = Number(sp.year) || new Date().getUTCFullYear();
    const summary = await getSellerLedgerSummary(session.sellerId, year);
    const history = await getSellerLedgerHistory(session.sellerId, 100);

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <header>
                    <Link href="/seller/keuangan" className="text-sm text-brand-primary hover:underline">
                        ← Keuangan
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                        Wallet & Mutasi Akuntansi
                    </h1>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        Saldo wallet (akun GL <code>22000</code>) dan riwayat mutasi yang menyebabkan
                        kenaikan / pengurangan saldo Anda. Data berasal dari jurnal POSTED — bersifat
                        final dan dapat di-reconcile dengan rekap penjualan.
                    </p>
                </header>

                <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="Saldo Wallet" value={fmtIDR(summary.walletBalance)} highlight />
                    <Stat label={`YTD Sales ${year}`} value={fmtIDR(summary.ytdGrossSales)} />
                    <Stat label={`YTD Komisi Platform ${year}`} value={fmtIDR(summary.ytdCommissionCharged)} />
                    <Stat label={`YTD Payouts ${year}`} value={fmtIDR(summary.ytdPayouts)} />
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
                                    <tr><td className="px-3 py-6 text-slate-500" colSpan={4}>Belum ada mutasi.</td></tr>
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
                    <b>Privasi:</b> Anda hanya melihat baris jurnal yang ditandai untuk akun Anda
                    (<code>partner_user_id = userId Anda</code>). Tidak ada akses ke jurnal seller lain.
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className={`mt-1 font-mono font-bold ${highlight ? "text-emerald-700" : "text-slate-900"}`}>Rp {value}</div>
        </div>
    );
}
