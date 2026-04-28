import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { getTrialBalance } from "@/actions/accounting/reports";
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

export default async function TrialBalancePrintPage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string; auto?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const auto = sp.auto === "1";

    const tb = await getTrialBalance({
        from: parseDate(fromStr),
        to: parseDate(toStr, true),
        book,
    });

    return (
        <PrintShell
            title="Trial Balance (Neraca Saldo)"
            subtitle={`Book: ${book} — Periode ${fromStr} s/d ${toStr}`}
            auto={auto}
        >
            <table className="print-table">
                <thead>
                    <tr>
                        <th>Kode</th>
                        <th>Akun</th>
                        <th>Class</th>
                        <th className="num">Debit</th>
                        <th className="num">Credit</th>
                        <th className="num">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    {tb.rows.map((r) => (
                        <tr key={r.code}>
                            <td>{r.code}</td>
                            <td>{r.name}</td>
                            <td>{r.class}</td>
                            <td className="num">{r.debit ? formatIdr(r.debit) : "-"}</td>
                            <td className="num">{r.credit ? formatIdr(r.credit) : "-"}</td>
                            <td className="num">{formatIdr(r.balance)}</td>
                        </tr>
                    ))}
                    {tb.rows.length === 0 ? (
                        <tr>
                            <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "#94a3b8" }}>
                                Tidak ada data untuk periode ini.
                            </td>
                        </tr>
                    ) : null}
                </tbody>
                <tfoot>
                    <tr className="print-total">
                        <td colSpan={3} className="num">TOTAL</td>
                        <td className="num">{formatIdr(tb.totalDebit)}</td>
                        <td className="num">{formatIdr(tb.totalCredit)}</td>
                        <td className="num">{tb.balanced ? "✓ BALANCED" : "⚠ NOT BALANCED"}</td>
                    </tr>
                </tfoot>
            </table>
        </PrintShell>
    );
}
