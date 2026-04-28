import Link from "next/link";
import { Banknote } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { listAffiliateLedgerSummaries } from "@/actions/accounting/affiliate-ledger";

export const dynamic = "force-dynamic";

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function AdminAffiliateLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await searchParams;
    const year = Number(sp.year) || new Date().getUTCFullYear();
    const rows = await listAffiliateLedgerSummaries(year);

    const totals = rows.reduce(
        (acc, r) => ({
            wallet: acc.wallet + r.walletBalance,
            accrued: acc.accrued + r.ytdAccrued,
            paid: acc.paid + r.ytdPaid,
            withheld: acc.withheld + r.ytdWithheldTotal,
        }),
        { wallet: 0, accrued: 0, paid: 0, withheld: 0 }
    );

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance" className="text-sm text-brand-primary hover:underline">
                        ← Finance
                    </Link>
                    <div className="mt-2 flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-heading font-bold uppercase tracking-tight text-slate-900 flex items-center gap-2">
                                <Banknote className="w-6 h-6 text-brand-primary" />
                                Sub-Ledger Affiliate
                            </h1>
                            <p className="mt-1 text-slate-600">
                                Saldo wallet komisi (akun <b>22200</b>) per affiliate, plus YTD accrual,
                                clawback, payment, dan pajak dipotong (PPh 21/23/4(2)).
                            </p>
                        </div>
                        <form className="flex items-center gap-2 text-sm">
                            <label className="text-slate-600">Tahun:</label>
                            <input
                                type="number"
                                name="year"
                                defaultValue={year}
                                min={2024}
                                max={2099}
                                className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                            />
                            <button type="submit" className="rounded-md bg-slate-900 text-white px-3 py-1.5 text-xs font-medium">
                                Tampilkan
                            </button>
                        </form>
                    </div>
                </header>

                <div className="grid gap-3 sm:grid-cols-4">
                    <Stat label="Total Wallet (saldo terutang)" value={fmtIDR(totals.wallet)} />
                    <Stat label={`YTD Accrued ${year}`} value={fmtIDR(totals.accrued)} />
                    <Stat label={`YTD Paid ${year}`} value={fmtIDR(totals.paid)} />
                    <Stat label={`YTD PPh Dipotong ${year}`} value={fmtIDR(totals.withheld)} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-3 py-2 text-left">Affiliate</th>
                                <th className="px-3 py-2 text-right">Saldo Wallet</th>
                                <th className="px-3 py-2 text-right">YTD Accrued</th>
                                <th className="px-3 py-2 text-right">YTD Reversed</th>
                                <th className="px-3 py-2 text-right">YTD Paid</th>
                                <th className="px-3 py-2 text-right">PPh 21</th>
                                <th className="px-3 py-2 text-right">PPh 23</th>
                                <th className="px-3 py-2 text-right">PPh 4(2)</th>
                                <th className="px-3 py-2 text-left">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td className="px-3 py-6 text-slate-500" colSpan={9}>Belum ada aktivitas affiliate di GL.</td></tr>
                            ) : rows.map((r) => (
                                <tr key={r.affiliateUserId} className="border-t border-slate-100">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-900">{r.name ?? "—"}</div>
                                        <div className="text-xs text-slate-500">{r.email ?? r.affiliateUserId.slice(0, 8)}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.walletBalance)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.ytdAccrued)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmtIDR(r.ytdReversed)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.ytdPaid)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtIDR(r.ytdWithheldPph21)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtIDR(r.ytdWithheldPph23)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-slate-500">{fmtIDR(r.ytdWithheldPph42)}</td>
                                    <td className="px-3 py-2">
                                        <Link
                                            href={`/admin/finance/affiliate-ledger/${r.affiliateUserId}`}
                                            className="text-brand-primary text-xs hover:underline"
                                        >
                                            Lihat →
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    Bukti Potong PPh PDF akan tersedia setelah modul export PDF (BullMQ + S3) di-deploy.
                    Saat ini total dipotong dapat diunduh per affiliate via halaman detail.
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className="mt-1 font-mono font-bold text-slate-900">Rp {value}</div>
        </div>
    );
}
