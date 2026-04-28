import { Fragment } from "react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getCashFlow } from "@/actions/accounting/reports";
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

export default async function CashFlowPrintPage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string; auto?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const auto = sp.auto === "1";

    const cf = await getCashFlow({
        from: parseDate(fromStr),
        to: parseDate(toStr, true),
        book,
    });

    return (
        <PrintShell
            title="Laporan Arus Kas (Cash Flow Statement)"
            subtitle={`PSAK 2 — Direct Method | Book: ${book} — Periode ${fromStr} s/d ${toStr}`}
            auto={auto}
        >
            <table className="print-table">
                <thead>
                    <tr>
                        <th>Aktivitas</th>
                        <th className="num">Inflow</th>
                        <th className="num">Outflow</th>
                        <th className="num">Net</th>
                    </tr>
                </thead>
                <tbody>
                    {cf.sections.map((s) => (
                        <Fragment key={s.section}>
                            <tr className="print-section">
                                <td colSpan={4}>{s.label}</td>
                            </tr>
                            {s.lines.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ fontStyle: "italic", color: "#94a3b8" }}>
                                        — tidak ada arus kas —
                                    </td>
                                </tr>
                            ) : (
                                s.lines.map((l) => (
                                    <tr key={l.bucket}>
                                        <td style={{ paddingLeft: 24 }}>{l.bucket}</td>
                                        <td className="num">{l.inflow ? formatIdr(l.inflow) : "-"}</td>
                                        <td className="num">{l.outflow ? formatIdr(l.outflow) : "-"}</td>
                                        <td className="num">{formatIdr(l.net)}</td>
                                    </tr>
                                ))
                            )}
                            <tr className="print-subtotal">
                                <td className="num">Subtotal {s.label}</td>
                                <td className="num">{formatIdr(s.inflow)}</td>
                                <td className="num">{formatIdr(s.outflow)}</td>
                                <td className="num">{formatIdr(s.net)}</td>
                            </tr>
                        </Fragment>
                    ))}
                    <tr className="print-total">
                        <td colSpan={3} className="num">KENAIKAN / (PENURUNAN) BERSIH KAS</td>
                        <td className="num">{formatIdr(cf.netCashChange)}</td>
                    </tr>
                    <tr>
                        <td colSpan={3} className="num">Saldo kas awal periode</td>
                        <td className="num">{formatIdr(cf.openingCash)}</td>
                    </tr>
                    <tr className="print-subtotal">
                        <td colSpan={3} className="num" style={{ background: "#f1f5f9" }}>SALDO KAS AKHIR PERIODE</td>
                        <td className="num" style={{ background: "#f1f5f9" }}>{formatIdr(cf.closingCash)}</td>
                    </tr>
                    <tr>
                        <td colSpan={4} style={{ paddingTop: 16, fontSize: 10, color: cf.reconciled ? "#15803d" : "#b91c1c", fontWeight: 700 }}>
                            {cf.reconciled ? "✓ RECONCILED" : `⚠ Tidak ter-rekonsiliasi (selisih ${formatIdr(cf.openingCash + cf.netCashChange - cf.closingCash)})`}
                        </td>
                    </tr>
                </tbody>
            </table>
        </PrintShell>
    );
}
