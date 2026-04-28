import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { accounting_periods } from "@/db/schema-accounting";
import { listPeriodSnapshots } from "@/actions/accounting/period-snapshot";

export const dynamic = "force-dynamic";

const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const REPORT_LABEL: Record<string, string> = {
    trial_balance: "Trial Balance",
    profit_loss: "Laba Rugi",
    balance_sheet: "Neraca",
    cash_flow: "Arus Kas",
};

const REPORT_HREF: Record<string, string> = {
    trial_balance: "/admin/finance/trial-balance",
    profit_loss: "/admin/finance/profit-loss",
    balance_sheet: "/admin/finance/balance-sheet",
    cash_flow: "/admin/finance/cash-flow",
};

function fmtIDR(n: unknown): string {
    const v = typeof n === "string" ? Number(n) : (n as number);
    if (!Number.isFinite(v)) return "-";
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function fmtTotalEntry(report: string, totals: Record<string, number> | null): React.ReactNode {
    if (!totals) return <span className="text-slate-400">—</span>;
    if (report === "trial_balance") {
        return (
            <div className="space-y-0.5">
                <div>Debit: <span className="font-mono">{fmtIDR(totals.totalDebit)}</span></div>
                <div>Kredit: <span className="font-mono">{fmtIDR(totals.totalCredit)}</span></div>
                <div className={totals.balanced ? "text-emerald-600" : "text-red-600 font-bold"}>
                    {totals.balanced ? "Balanced" : "UNBALANCED"}
                </div>
            </div>
        );
    }
    if (report === "profit_loss") {
        return (
            <div className="space-y-0.5">
                <div>Gross: <span className="font-mono">{fmtIDR(totals.grossProfit)}</span></div>
                <div>Operating: <span className="font-mono">{fmtIDR(totals.operatingProfit)}</span></div>
                <div>Net: <span className="font-mono font-bold">{fmtIDR(totals.netProfit)}</span></div>
            </div>
        );
    }
    if (report === "balance_sheet") {
        return (
            <div className="space-y-0.5">
                <div>Aset: <span className="font-mono">{fmtIDR(totals.totalAssets)}</span></div>
                <div>Lia+Eq: <span className="font-mono">{fmtIDR(totals.totalLiabEq)}</span></div>
                <div className={totals.balanced ? "text-emerald-600" : "text-red-600 font-bold"}>
                    {totals.balanced ? "Balanced" : "UNBALANCED"}
                </div>
            </div>
        );
    }
    if (report === "cash_flow") {
        return (
            <div className="space-y-0.5">
                <div>Opening: <span className="font-mono">{fmtIDR(totals.openingCash)}</span></div>
                <div>Net Δ: <span className="font-mono">{fmtIDR(totals.netCashChange)}</span></div>
                <div>Closing: <span className="font-mono font-bold">{fmtIDR(totals.closingCash)}</span></div>
            </div>
        );
    }
    return <pre className="text-xs">{JSON.stringify(totals, null, 2)}</pre>;
}

export default async function PeriodSnapshotPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAdminFinanceReader();
    const { id } = await params;

    const periodRows = await db
        .select()
        .from(accounting_periods)
        .where(eq(accounting_periods.id, id))
        .limit(1);
    const period = periodRows[0];
    if (!period) notFound();

    const snapshots = await listPeriodSnapshots(id);
    const byReport = new Map(snapshots.map((s) => [s.report, s]));
    const reports: Array<"trial_balance" | "profit_loss" | "balance_sheet" | "cash_flow"> = [
        "trial_balance", "profit_loss", "balance_sheet", "cash_flow",
    ];

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance/period" className="text-sm text-brand-primary hover:underline">
                        ← Periode
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Snapshot Periode {monthNames[period.month]} {period.year}
                    </h1>
                    <p className="mt-1 text-slate-600">
                        Status: <b>{period.status}</b> · Buku: <b>{period.book}</b> ·{" "}
                        {String(period.starts_at)} → {String(period.ends_at)}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        Snapshot ini dibekukan saat periode di-CLOSE. Re-open + Close ulang akan
                        menimpa snapshot ini.
                    </p>
                </header>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-4 py-3 text-left">Laporan</th>
                                <th className="px-4 py-3 text-left">Ringkasan</th>
                                <th className="px-4 py-3 text-left">Captured</th>
                                <th className="px-4 py-3 text-left">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((rep) => {
                                const snap = byReport.get(rep);
                                return (
                                    <tr key={rep} className="border-t border-slate-100 align-top">
                                        <td className="px-4 py-3 font-medium">
                                            {REPORT_LABEL[rep]}
                                        </td>
                                        <td className="px-4 py-3">
                                            {snap ? fmtTotalEntry(rep, snap.totals) : (
                                                <span className="text-slate-400">Belum ada snapshot</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            {snap ? (
                                                <>
                                                    <div>{new Date(snap.capturedAt).toLocaleString("id-ID")}</div>
                                                    <div className="font-mono">{snap.capturedBy ?? "—"}</div>
                                                </>
                                            ) : "—"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={REPORT_HREF[rep]}
                                                className="text-xs text-brand-primary hover:underline"
                                            >
                                                Lihat Live →
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <b className="text-slate-900">Catatan:</b> Snapshot menyimpan payload jsonb
                    lengkap (lihat tabel <code>accounting_period_snapshot</code>). Ini menjadi
                    sumber audit final jika ada perbedaan dengan tampilan live akibat backdated
                    journal pada periode reopened.
                </div>
            </div>
        </div>
    );
}
