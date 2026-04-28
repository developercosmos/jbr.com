import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getBalanceSheet, type ProfitLossSection } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";
import PrintShell from "../../_print/PrintShell";

export const dynamic = "force-dynamic";

function parseDate(s: string | undefined): Date | undefined {
    if (!s) return undefined;
    const d = new Date(`${s}T23:59:59`);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function defaultAsOf() {
    return new Date().toISOString().slice(0, 10);
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
                        — tidak ada saldo —
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

export default async function BalanceSheetPrintPage(props: {
    searchParams: Promise<{ asOf?: string; book?: string; auto?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const asOfStr = sp.asOf ?? defaultAsOf();
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const auto = sp.auto === "1";

    const bs = await getBalanceSheet({ asOf: parseDate(asOfStr), book });

    return (
        <PrintShell
            title="Neraca (Balance Sheet)"
            subtitle={`Book: ${book} — per tanggal ${asOfStr}`}
            auto={auto}
        >
            <table className="print-table">
                <tbody>
                    <Section s={bs.assets} />
                    <tr className="print-subtotal">
                        <td colSpan={2} className="num" style={{ background: "#f1f5f9" }}>TOTAL ASET</td>
                        <td className="num" style={{ background: "#f1f5f9" }}>{formatIdr(bs.assets.subtotal)}</td>
                    </tr>

                    <tr><td colSpan={3} style={{ height: 12, border: "none" }} /></tr>

                    <Section s={bs.liabilities} />
                    <Section s={bs.equity} />
                    <tr>
                        <td>—</td>
                        <td>Laba Berjalan YTD (Retained Earnings)</td>
                        <td className="num">{formatIdr(bs.retainedEarningsYtd)}</td>
                    </tr>
                    <tr className="print-total">
                        <td colSpan={2} className="num">TOTAL LIABILITAS + EKUITAS</td>
                        <td className="num">{formatIdr(bs.totalLiabilitiesAndEquity)}</td>
                    </tr>

                    <tr>
                        <td colSpan={3} style={{ paddingTop: 16, fontSize: 10, color: bs.balanced ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                            {bs.balanced ? "✓ NERACA BALANCED" : "⚠ NERACA TIDAK BALANCED — periksa journal lines"}
                        </td>
                    </tr>
                </tbody>
            </table>
        </PrintShell>
    );
}
