import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getTrialBalance } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

function parseDate(s: string | undefined): Date | undefined {
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : undefined;
}

function defaultRange() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function AdminTrialBalancePage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";

    const from = parseDate(fromStr);
    const to = parseDate(toStr ? `${toStr}T23:59:59` : undefined);
    const tb = await getTrialBalance({ from, to, book });

    const exportHref = `/api/admin/finance/export/trial-balance?from=${encodeURIComponent(
        fromStr
    )}&to=${encodeURIComponent(toStr)}&book=${book}`;
    const printHref = `/admin/finance/trial-balance/print?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}&auto=1`;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                            &larr; Finance
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Trial Balance
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={exportHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
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
                    <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                        Apply
                    </button>
                </form>

                <div
                    className={`rounded-lg border px-4 py-3 text-sm ${
                        tb.balanced
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-800"
                    }`}
                >
                    {tb.balanced ? "Balanced" : "NOT BALANCED — silakan investigasi journal lines"}: total debit{" "}
                    <strong>{formatIdr(tb.totalDebit)}</strong> vs total kredit{" "}
                    <strong>{formatIdr(tb.totalCredit)}</strong>.
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Code</th>
                                <th className="px-4 py-3 text-left">Account</th>
                                <th className="px-4 py-3 text-left">Class</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Credit</th>
                                <th className="px-4 py-3 text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tb.rows.map((r) => (
                                <tr key={r.code} className="hover:bg-slate-50">
                                    <td className="px-4 py-2 font-mono text-xs">
                                        <Link
                                            href={`/admin/finance/general-ledger?account=${r.code}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}`}
                                            className="text-brand-primary hover:underline"
                                        >
                                            {r.code}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-2">{r.name}</td>
                                    <td className="px-4 py-2 text-xs text-slate-500">{r.class}</td>
                                    <td className="px-4 py-2 text-right font-mono">{r.debit ? formatIdr(r.debit) : "-"}</td>
                                    <td className="px-4 py-2 text-right font-mono">{r.credit ? formatIdr(r.credit) : "-"}</td>
                                    <td className="px-4 py-2 text-right font-mono font-semibold">
                                        {formatIdr(r.balance)}
                                    </td>
                                </tr>
                            ))}
                            {tb.rows.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                        Tidak ada data untuk periode ini.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-50 font-semibold">
                            <tr>
                                <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider text-xs">Total</td>
                                <td className="px-4 py-3 text-right font-mono">{formatIdr(tb.totalDebit)}</td>
                                <td className="px-4 py-3 text-right font-mono">{formatIdr(tb.totalCredit)}</td>
                                <td className="px-4 py-3" />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}
