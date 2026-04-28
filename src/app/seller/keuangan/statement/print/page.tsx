import { requireSellerFinanceSession } from "@/lib/seller-finance";
import { getSellerSalesSummary, getSellerSalesDetail } from "@/actions/accounting/reports";
import PrintShell from "@/app/admin/finance/_print/PrintShell";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function parseDate(s: string | undefined, endOfDay = false): Date | undefined {
    if (!s) return undefined;
    const iso = endOfDay ? `${s}T23:59:59` : s;
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function periodRange(input: { from?: string; to?: string; year?: string; month?: string }) {
    if (input.year && input.month) {
        const y = Number(input.year);
        const m = Number(input.month);
        const from = new Date(Date.UTC(y, m - 1, 1));
        const to = new Date(Date.UTC(y, m, 0, 23, 59, 59));
        return {
            from,
            to,
            label: `${monthNames[m]} ${y}`,
        };
    }
    if (input.from && input.to) {
        return {
            from: parseDate(input.from)!,
            to: parseDate(input.to, true)!,
            label: `${input.from} → ${input.to}`,
        };
    }
    // default: current month
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from, to, label: `${monthNames[now.getUTCMonth() + 1]} ${now.getUTCFullYear()}` };
}

export default async function SellerStatementPrintPage(props: {
    searchParams: Promise<{ from?: string; to?: string; year?: string; month?: string; auto?: string }>;
}) {
    const session = await requireSellerFinanceSession();
    const sp = await props.searchParams;
    const range = periodRange(sp);
    const auto = sp.auto === "1";

    const [summary, detail] = await Promise.all([
        getSellerSalesSummary({ sellerId: session.sellerId, from: range.from, to: range.to }),
        getSellerSalesDetail({ sellerId: session.sellerId, from: range.from, to: range.to, limit: 1000 }),
    ]);

    return (
        <PrintShell
            title={`Laporan Penjualan Toko — ${range.label}`}
            subtitle={`${session.storeName} · Seller ID: ${session.sellerId}`}
            auto={auto}
        >
            <section className="mb-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                    Ringkasan Periode
                </h2>
                <table className="print-table">
                    <tbody>
                        <tr>
                            <td>Jumlah Transaksi Penjualan</td>
                            <td className="num">{summary.counts.sales}</td>
                        </tr>
                        <tr>
                            <td>Jumlah Transaksi Refund</td>
                            <td className="num">{summary.counts.refunds}</td>
                        </tr>
                        <tr>
                            <td>Penjualan Bruto</td>
                            <td className="num">{formatIdr(summary.totals.gross)}</td>
                        </tr>
                        <tr>
                            <td>Diskon</td>
                            <td className="num">({formatIdr(summary.totals.discount)})</td>
                        </tr>
                        <tr>
                            <td>Ongkir</td>
                            <td className="num">{formatIdr(summary.totals.shipping)}</td>
                        </tr>
                        <tr>
                            <td>Fee Platform</td>
                            <td className="num">({formatIdr(summary.totals.platformFee)})</td>
                        </tr>
                        <tr>
                            <td>Komisi Affiliate</td>
                            <td className="num">({formatIdr(summary.totals.affiliateCommission)})</td>
                        </tr>
                        <tr className="print-subtotal">
                            <td>Net Toko (sebelum refund)</td>
                            <td className="num">{formatIdr(summary.totals.sellerNet)}</td>
                        </tr>
                        <tr>
                            <td>Refund Bruto</td>
                            <td className="num">({formatIdr(summary.refunds.gross)})</td>
                        </tr>
                        <tr>
                            <td>Refund Net Toko</td>
                            <td className="num">({formatIdr(summary.refunds.sellerNet)})</td>
                        </tr>
                        <tr className="print-total">
                            <td>NET PAYOUT</td>
                            <td className="num">{formatIdr(summary.netPayoutEligible)}</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-700">
                    Rincian Transaksi ({detail.rows.length} dari {detail.total})
                </h2>
                <table className="print-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Event</th>
                            <th>Order</th>
                            <th>SKU</th>
                            <th className="num">Qty</th>
                            <th className="num">Bruto</th>
                            <th className="num">Fee</th>
                            <th className="num">Net</th>
                        </tr>
                    </thead>
                    <tbody>
                        {detail.rows.map((r) => (
                            <tr key={r.id}>
                                <td>{r.eventAt.slice(0, 10)}</td>
                                <td>{r.event}</td>
                                <td className="font-mono text-[10px]">{r.orderId.slice(0, 8)}</td>
                                <td className="font-mono text-[10px]">{r.sku ?? "-"}</td>
                                <td className="num">{r.qty}</td>
                                <td className="num">{formatIdr(r.gross)}</td>
                                <td className="num">{formatIdr(r.platformFee)}</td>
                                <td className="num">{formatIdr(r.sellerNet)}</td>
                            </tr>
                        ))}
                        {detail.rows.length === 0 && (
                            <tr>
                                <td colSpan={8} className="text-center text-slate-500">
                                    Tidak ada transaksi pada periode ini.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </section>

            <section className="mt-8 border-t border-slate-300 pt-4 text-[10px] text-slate-500">
                <p>
                    <b>Catatan:</b> Net Payout adalah estimasi nominal yang berhak diterima toko
                    untuk periode di atas, sebelum dikurangi pajak (PPh Pasal 22 e-commerce, jika
                    berlaku). Saldo wallet aktual dapat dilihat di halaman Wallet & Mutasi GL.
                </p>
                <p className="mt-2">
                    Sumber data: <code>sales_register</code> (PSAK GL Phase 5+). Periode laporan:{" "}
                    {range.from.toISOString().slice(0, 10)} sampai {range.to.toISOString().slice(0, 10)}.
                </p>
            </section>
        </PrintShell>
    );
}
