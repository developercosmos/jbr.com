import Link from "next/link";
import { Download, TrendingUp, ShoppingBag, RefreshCcw, Wallet, Printer } from "lucide-react";
import { requireSellerFinanceSession } from "@/lib/seller-finance";
import { getSellerSalesSummary, getSellerSalesDetail } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

function defaultRange() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
    if (!s) return undefined;
    const iso = endOfDay ? `${s}T23:59:59` : s;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

export default async function SellerKeuanganPage(props: {
    searchParams: Promise<{ from?: string; to?: string }>;
}) {
    // SECURITY (GL-30): sellerId is derived from session ONLY, never from query.
    const session = await requireSellerFinanceSession();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const from = parseDate(fromStr);
    const to = parseDate(toStr, true);

    const [summary, detail] = await Promise.all([
        getSellerSalesSummary({ sellerId: session.sellerId, from, to }),
        getSellerSalesDetail({ sellerId: session.sellerId, from, to, limit: 50 }),
    ]);

    const exportHref = `/api/seller/keuangan/export/sales?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;
    const printHref = `/seller/keuangan/statement/print?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}`;

    const stats = [
        {
            label: "Penjualan Bruto",
            value: summary.totals.gross,
            sub: `${summary.counts.sales} transaksi`,
            icon: ShoppingBag,
            color: "text-blue-600 bg-blue-50",
        },
        {
            label: "Pengembalian (Refund)",
            value: summary.refunds.gross,
            sub: `${summary.counts.refunds} transaksi`,
            icon: RefreshCcw,
            color: "text-orange-600 bg-orange-50",
        },
        {
            label: "Net Revenue",
            value: summary.netRevenue,
            sub: "Bruto − Refund",
            icon: TrendingUp,
            color: "text-emerald-600 bg-emerald-50",
        },
        {
            label: "Net Payout (Estimasi)",
            value: summary.netPayoutEligible,
            sub: "Setelah fee platform",
            icon: Wallet,
            color: "text-brand-primary bg-brand-primary/10",
        },
    ];

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/seller" className="text-sm text-slate-500 hover:text-brand-primary">
                            &larr; Seller Center
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Keuangan
                        </h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Ringkasan penjualan toko <strong>{session.storeName}</strong>. Data berasal dari sales register PSAK.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/seller/keuangan/ledger" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary">
                            <Wallet className="w-4 h-4" /> Wallet & Mutasi GL
                        </Link>
                        <Link href={exportHref} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                            <Download className="w-4 h-4" /> Export CSV
                        </Link>
                        <Link href={printHref} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary">
                            <Printer className="w-4 h-4" /> Cetak PDF
                        </Link>
                    </div>
                </div>

                <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <label className="flex flex-col text-xs font-medium text-slate-600">
                        Dari
                        <input type="date" name="from" defaultValue={fromStr} className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                    </label>
                    <label className="flex flex-col text-xs font-medium text-slate-600">
                        Sampai
                        <input type="date" name="to" defaultValue={toStr} className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
                    </label>
                    <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
                </form>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((s) => (
                        <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className={`rounded-xl p-2 ${s.color}`}><s.icon className="w-5 h-5" /></span>
                                <span className="text-xs uppercase tracking-wider text-slate-400">{s.sub}</span>
                            </div>
                            <p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{s.label}</p>
                            <p className="mt-1 text-xl font-heading font-extrabold text-slate-900">{formatIdr(s.value)}</p>
                        </div>
                    ))}
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-1">
                        <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">Breakdown Periode</h2>
                        <dl className="mt-4 space-y-2 text-sm">
                            <div className="flex justify-between"><dt className="text-slate-500">Bruto</dt><dd className="font-mono">{formatIdr(summary.totals.gross)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Diskon</dt><dd className="font-mono">{formatIdr(-summary.totals.discount)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Ongkir</dt><dd className="font-mono">{formatIdr(summary.totals.shipping)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Fee Platform</dt><dd className="font-mono">{formatIdr(-summary.totals.platformFee)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Komisi Affiliate</dt><dd className="font-mono">{formatIdr(-summary.totals.affiliateCommission)}</dd></div>
                            <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-semibold text-slate-900">Net Toko (sebelum refund)</dt><dd className="font-mono font-semibold">{formatIdr(summary.totals.sellerNet)}</dd></div>
                            <div className="flex justify-between"><dt className="text-slate-500">Refund (Net Toko)</dt><dd className="font-mono">{formatIdr(-summary.refunds.sellerNet)}</dd></div>
                            <div className="flex justify-between border-t border-slate-200 pt-2"><dt className="font-bold text-brand-primary">Net Payout</dt><dd className="font-mono font-bold text-brand-primary">{formatIdr(summary.netPayoutEligible)}</dd></div>
                        </dl>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white lg:col-span-2 overflow-hidden">
                        <div className="border-b border-slate-200 px-5 py-3 flex items-center justify-between">
                            <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">Transaksi Terbaru</h2>
                            <span className="text-xs text-slate-500">Menampilkan 50 dari {detail.total}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Tanggal</th>
                                        <th className="px-4 py-2 text-left">Event</th>
                                        <th className="px-4 py-2 text-left">SKU</th>
                                        <th className="px-4 py-2 text-right">Qty</th>
                                        <th className="px-4 py-2 text-right">Bruto</th>
                                        <th className="px-4 py-2 text-right">Fee</th>
                                        <th className="px-4 py-2 text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detail.rows.map((r) => (
                                        <tr key={r.id} className={r.event === "REFUND" ? "bg-orange-50/50" : ""}>
                                            <td className="px-4 py-1.5 font-mono text-xs">{r.eventAt.slice(0, 10)}</td>
                                            <td className="px-4 py-1.5 text-xs">
                                                <span className={`rounded px-1.5 py-0.5 ${r.event === "SALE" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>{r.event}</span>
                                            </td>
                                            <td className="px-4 py-1.5 font-mono text-xs">{r.sku ?? "-"}</td>
                                            <td className="px-4 py-1.5 text-right font-mono">{r.qty}</td>
                                            <td className="px-4 py-1.5 text-right font-mono">{formatIdr(r.gross)}</td>
                                            <td className="px-4 py-1.5 text-right font-mono">{formatIdr(r.platformFee)}</td>
                                            <td className="px-4 py-1.5 text-right font-mono font-semibold">{formatIdr(r.sellerNet)}</td>
                                        </tr>
                                    ))}
                                    {detail.rows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Belum ada transaksi pada periode ini.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
