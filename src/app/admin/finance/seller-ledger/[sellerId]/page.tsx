import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import {
    getSellerLedgerHistory,
    getSellerLedgerSummary,
} from "@/actions/accounting/seller-ledger";

export const dynamic = "force-dynamic";

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function AdminSellerLedgerDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ sellerId: string }>;
    searchParams: Promise<{ year?: string }>;
}) {
    await requireAdminFinanceReader();
    const { sellerId } = await params;
    if (!sellerId) notFound();
    const sp = await searchParams;
    const year = Number(sp.year) || new Date().getUTCFullYear();
    const summary = await getSellerLedgerSummary(sellerId, year);
    const history = await getSellerLedgerHistory(sellerId, 200);

    return (
        <div className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance/seller-ledger" className="text-sm text-brand-primary hover:underline">
                        ← Sub-Ledger Seller
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        {summary.name ?? "Seller"} <span className="font-mono text-base text-slate-500">{summary.email}</span>
                    </h1>
                </header>

                <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="Saldo Wallet" value={fmtIDR(summary.walletBalance)} highlight />
                    <Stat label={`YTD Sales ${year}`} value={fmtIDR(summary.ytdGrossSales)} />
                    <Stat label={`YTD Komisi ${year}`} value={fmtIDR(summary.ytdCommissionCharged)} />
                    <Stat label={`YTD Payouts ${year}`} value={fmtIDR(summary.ytdPayouts)} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-3 py-2 text-left">Tanggal</th>
                                <th className="px-3 py-2 text-left">Jurnal</th>
                                <th className="px-3 py-2 text-left">Akun</th>
                                <th className="px-3 py-2 text-right">Debit</th>
                                <th className="px-3 py-2 text-right">Kredit</th>
                                <th className="px-3 py-2 text-left">Memo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr><td className="px-3 py-6 text-slate-500" colSpan={6}>Belum ada mutasi.</td></tr>
                            ) : history.map((h) => (
                                <tr key={h.journalId + h.accountCode} className="border-t border-slate-100">
                                    <td className="px-3 py-2 text-xs">{new Date(h.postedAt).toLocaleString("id-ID")}</td>
                                    <td className="px-3 py-2">
                                        <div className="font-mono text-xs">{h.journalNo}</div>
                                        <div className="text-xs text-slate-500">{h.description}</div>
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">{h.accountCode} <span className="text-slate-500">{h.accountName}</span></td>
                                    <td className="px-3 py-2 text-right font-mono">{h.debit ? fmtIDR(h.debit) : ""}</td>
                                    <td className="px-3 py-2 text-right font-mono">{h.credit ? fmtIDR(h.credit) : ""}</td>
                                    <td className="px-3 py-2 text-xs text-slate-500">{h.memo}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
