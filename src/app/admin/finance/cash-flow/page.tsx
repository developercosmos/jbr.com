import Link from "next/link";
import { Fragment } from "react";
import { Printer, Download } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getCashFlow } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

function defaultRange() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function parseDate(s: string | undefined, eod = false): Date | undefined {
    if (!s) return undefined;
    const d = new Date(eod ? `${s}T23:59:59` : s);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

export default async function AdminCashFlowPage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";

    const cf = await getCashFlow({
        from: parseDate(fromStr),
        to: parseDate(toStr, true),
        book,
    });

    const printHref = `/admin/finance/cash-flow/print?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}&auto=1`;
    const exportHref = `/api/admin/finance/export/cash-flow?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}`;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                            &larr; Finance
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Laporan Arus Kas
                        </h1>
                        <p className="mt-1 text-xs text-slate-500">PSAK 2 — Direct Method (Metode Langsung)</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={exportHref} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                            <Download className="w-4 h-4" /> Export CSV
                        </Link>
                        <Link
                            href={printHref}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary"
                        >
                            <Printer className="w-4 h-4" /> Print PDF
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
                    <label className="flex flex-col text-xs font-medium text-slate-600">
                        Book
                        <select name="book" defaultValue={book} className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                            <option value="PLATFORM">PLATFORM</option>
                            <option value="SELLER">SELLER</option>
                        </select>
                    </label>
                    <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Apply</button>
                </form>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Aktivitas</th>
                                <th className="px-4 py-3 text-right">Inflow</th>
                                <th className="px-4 py-3 text-right">Outflow</th>
                                <th className="px-4 py-3 text-right">Net</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {cf.sections.map((s) => (
                                <Fragment key={s.section}>
                                    <tr className="bg-slate-50">
                                        <td colSpan={4} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                                            {s.label}
                                        </td>
                                    </tr>
                                    {s.lines.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-2 text-xs italic text-slate-400">
                                                Tidak ada arus kas pada aktivitas ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        s.lines.map((l) => (
                                            <tr key={`${s.section}:${l.bucket}`}>
                                                <td className="px-4 py-1.5 pl-8 font-mono text-xs">{l.bucket}</td>
                                                <td className="px-4 py-1.5 text-right font-mono text-xs text-emerald-700">{l.inflow ? formatIdr(l.inflow) : "-"}</td>
                                                <td className="px-4 py-1.5 text-right font-mono text-xs text-red-700">{l.outflow ? formatIdr(l.outflow) : "-"}</td>
                                                <td className="px-4 py-1.5 text-right font-mono text-xs">{formatIdr(l.net)}</td>
                                            </tr>
                                        ))
                                    )}
                                    <tr className="border-t border-slate-200 bg-slate-50">
                                        <td className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider">Subtotal {s.label}</td>
                                        <td className="px-4 py-2 text-right font-mono text-xs font-semibold">{formatIdr(s.inflow)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-xs font-semibold">{formatIdr(s.outflow)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(s.net)}</td>
                                    </tr>
                                </Fragment>
                            ))}
                            <tr className="bg-brand-primary/10 border-t-2 border-brand-primary">
                                <td colSpan={3} className="px-4 py-3 text-right text-base font-extrabold uppercase tracking-wider text-brand-primary">
                                    Kenaikan / (Penurunan) Bersih Kas
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-base font-extrabold text-brand-primary">
                                    {formatIdr(cf.netCashChange)}
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-right text-xs text-slate-600">
                                    Saldo kas awal periode
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-xs">{formatIdr(cf.openingCash)}</td>
                            </tr>
                            <tr className="bg-slate-100">
                                <td colSpan={3} className="px-4 py-2 text-right text-sm font-bold uppercase tracking-wider">
                                    Saldo kas akhir periode
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(cf.closingCash)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className={`rounded-lg border px-4 py-3 text-sm ${cf.reconciled ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    {cf.reconciled
                        ? "✓ Reconciled — opening + Δ kas = closing."
                        : `⚠ Tidak ter-rekonsiliasi (selisih ${formatIdr(cf.openingCash + cf.netCashChange - cf.closingCash)}).`}
                </div>
            </div>
        </div>
    );
}
