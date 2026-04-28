import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { getProfitLoss, type ProfitLossSection } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";
import PrintShell from "../../_print/PrintShell";

export const dynamic = "force-dynamic";

function parseDate(s: string | undefined, eod = false): Date | undefined {
    if (!s) return undefined;
    const d = new Date(eod ? `${s}T23:59:59` : s);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function defaultRange() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function Section({ s }: { s: ProfitLossSection }) {
    if (s.rows.length === 0) {
        return (
            <>
                <tr className="print-section">
                    <td colSpan={3}>{s.label}</td>
                </tr>
                <tr>
                    <td colSpan={3} style={{ fontStyle: "italic", color: "#94a3b8" }}>
                        — tidak ada data —
                    </td>
                </tr>
            </>
        );
    }
    return (
        <>
            <tr className="print-section">
                <td colSpan={3}>{s.label}</td>
            </tr>
            {s.rows.map((r) => (
                <tr key={r.code}>
                    <td style={{ width: 80 }}>{r.code}</td>
                    <td>{r.name}</td>
                    <td className="num">{formatIdr(r.balance)}</td>
                </tr>
            ))}
            <tr className="print-subtotal">
                <td colSpan={2} className="num">Subtotal {s.label}</td>
                <td className="num">{formatIdr(s.subtotal)}</td>
            </tr>
        </>
    );
}

export default async function ProfitLossPrintPage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string; auto?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const auto = sp.auto === "1";

    const pl = await getProfitLoss({
        from: parseDate(fromStr),
        to: parseDate(toStr, true),
        book,
    });

    return (
        <PrintShell
            title="Laporan Laba Rugi (Profit & Loss)"
            subtitle={`Book: ${book} — Periode ${fromStr} s/d ${toStr}`}
            auto={auto}
        >
            <table className="print-table">
                <tbody>
                    <Section s={pl.revenue} />
                    <Section s={pl.contraRevenue} />
                    <Section s={pl.cogs} />
                    <tr className="print-subtotal">
                        <td colSpan={2} className="num" style={{ background: "#f1f5f9" }}>LABA KOTOR</td>
                        <td className="num" style={{ background: "#f1f5f9" }}>{formatIdr(pl.grossProfit)}</td>
                    </tr>
                    <Section s={pl.opex} />
                    <tr className="print-subtotal">
                        <td colSpan={2} className="num" style={{ background: "#f1f5f9" }}>LABA OPERASI</td>
                        <td className="num" style={{ background: "#f1f5f9" }}>{formatIdr(pl.operatingProfit)}</td>
                    </tr>
                    <Section s={pl.otherIncome} />
                    <Section s={pl.otherExpense} />
                    <tr className="print-subtotal">
                        <td colSpan={2} className="num" style={{ background: "#f1f5f9" }}>LABA SEBELUM PAJAK</td>
                        <td className="num" style={{ background: "#f1f5f9" }}>{formatIdr(pl.profitBeforeTax)}</td>
                    </tr>
                    <Section s={pl.taxExpense} />
                    <tr className="print-total">
                        <td colSpan={2} className="num">LABA BERSIH</td>
                        <td className="num">{formatIdr(pl.netProfit)}</td>
                    </tr>
                </tbody>
            </table>
        </PrintShell>
    );
}
