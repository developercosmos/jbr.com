import Link from "next/link";
import { Store } from "lucide-react";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listSellerLedgerSummaries } from "@/actions/accounting/seller-ledger";

export const dynamic = "force-dynamic";

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function AdminSellerLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await searchParams;
    const year = Number(sp.year) || new Date().getUTCFullYear();
    const rows = await listSellerLedgerSummaries(year);

    const totals = rows.reduce(
        (acc, r) => ({
            wallet: acc.wallet + r.walletBalance,
            sales: acc.sales + r.ytdGrossSales,
            commission: acc.commission + r.ytdCommissionCharged,
            payouts: acc.payouts + r.ytdPayouts,
        }),
        { wallet: 0, sales: 0, commission: 0, payouts: 0 }
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
                                <Store className="w-6 h-6 text-brand-primary" />
                                Sub-Ledger Seller
                            </h1>
                            <p className="mt-1 text-slate-600">
                                Saldo wallet (akun <b>22000</b>) per seller, gross sales YTD, komisi yang
                                dibebankan platform, dan total payout.
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
                    <Stat label="Total Wallet (terutang ke seller)" value={fmtIDR(totals.wallet)} />
                    <Stat label={`YTD Gross Sales ${year}`} value={fmtIDR(totals.sales)} />
                    <Stat label={`YTD Komisi Platform ${year}`} value={fmtIDR(totals.commission)} />
                    <Stat label={`YTD Payouts ${year}`} value={fmtIDR(totals.payouts)} />
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-3 py-2 text-left">Seller</th>
                                <th className="px-3 py-2 text-right">Saldo Wallet</th>
                                <th className="px-3 py-2 text-right">YTD Gross Sales</th>
                                <th className="px-3 py-2 text-right">YTD Komisi Platform</th>
                                <th className="px-3 py-2 text-right">YTD Refunds</th>
                                <th className="px-3 py-2 text-right">YTD Payouts</th>
                                <th className="px-3 py-2 text-left">Detail</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr><td className="px-3 py-6 text-slate-500" colSpan={7}>Belum ada aktivitas seller di GL.</td></tr>
                            ) : rows.map((r) => (
                                <tr key={r.sellerId} className="border-t border-slate-100">
                                    <td className="px-3 py-2">
                                        <div className="font-medium text-slate-900">{r.name ?? "—"}</div>
                                        <div className="text-xs text-slate-500">{r.email ?? r.sellerId.slice(0, 8)}</div>
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.walletBalance)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.ytdGrossSales)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.ytdCommissionCharged)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-amber-700">{fmtIDR(r.ytdRefundsImpact)}</td>
                                    <td className="px-3 py-2 text-right font-mono">{fmtIDR(r.ytdPayouts)}</td>
                                    <td className="px-3 py-2">
                                        <Link
                                            href={`/admin/finance/seller-ledger/${r.sellerId}`}
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
                    Tier-1.5 view — semua data dari PLATFORM book journal_lines yang ditandai
                    <code> partner_role=&apos;SELLER&apos;</code>. Tier-2 (full per-seller GL dengan COA terpisah)
                    direncanakan pada fase berikutnya.
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
