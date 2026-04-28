import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { getProfitLoss, type ProfitLossSection } from "@/actions/accounting/reports";
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

function SectionRows({ section }: { section: ProfitLossSection }) {
    if (section.rows.length === 0) {
        return (
            <tr>
                <td colSpan={3} className="px-4 py-2 text-sm text-slate-400 italic">
                    {section.label}: tidak ada data
                </td>
            </tr>
        );
    }
    return (
        <>
            <tr className="bg-slate-50">
                <td colSpan={3} className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600">
                    {section.label}
                </td>
            </tr>
            {section.rows.map((r) => (
                <tr key={r.code}>
                    <td className="px-4 py-1.5 font-mono text-xs text-slate-500">{r.code}</td>
                    <td className="px-4 py-1.5 text-sm">{r.name}</td>
                    <td className="px-4 py-1.5 text-right font-mono text-sm">{formatIdr(r.balance)}</td>
                </tr>
            ))}
            <tr className="border-t border-slate-200">
                <td colSpan={2} className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Subtotal {section.label}
                </td>
                <td className="px-4 py-2 text-right font-mono text-sm font-semibold">
                    {formatIdr(section.subtotal)}
                </td>
            </tr>
        </>
    );
}

export default async function AdminProfitLossPage(props: {
    searchParams: Promise<{ from?: string; to?: string; book?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";

    const pl = await getProfitLoss({
        from: parseDate(fromStr),
        to: parseDate(toStr, true),
        book,
    });

    const exportHref = `/api/admin/finance/export/profit-loss?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}`;
    const printHref = `/admin/finance/profit-loss/print?from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}&auto=1`;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                            &larr; Finance
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Laporan Laba Rugi
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href={exportHref} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                            <Download className="w-4 h-4" /> Export CSV
                        </Link>
                        <Link href={printHref} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary hover:text-brand-primary">
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
                    <table className="w-full">
                        <tbody>
                            <SectionRows section={pl.revenue} />
                            <SectionRows section={pl.contraRevenue} />
                            <SectionRows section={pl.cogs} />
                            <tr className="bg-slate-100">
                                <td colSpan={2} className="px-4 py-2 text-right text-sm font-bold uppercase tracking-wider">Laba Kotor</td>
                                <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(pl.grossProfit)}</td>
                            </tr>
                            <SectionRows section={pl.opex} />
                            <tr className="bg-slate-100">
                                <td colSpan={2} className="px-4 py-2 text-right text-sm font-bold uppercase tracking-wider">Laba Operasi</td>
                                <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(pl.operatingProfit)}</td>
                            </tr>
                            <SectionRows section={pl.otherIncome} />
                            <SectionRows section={pl.otherExpense} />
                            <tr className="bg-slate-100">
                                <td colSpan={2} className="px-4 py-2 text-right text-sm font-bold uppercase tracking-wider">Laba Sebelum Pajak</td>
                                <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(pl.profitBeforeTax)}</td>
                            </tr>
                            <SectionRows section={pl.taxExpense} />
                            <tr className="bg-brand-primary/10 border-t-2 border-brand-primary">
                                <td colSpan={2} className="px-4 py-3 text-right text-base font-extrabold uppercase tracking-wider text-brand-primary">Laba Bersih</td>
                                <td className="px-4 py-3 text-right font-mono text-base font-extrabold text-brand-primary">{formatIdr(pl.netProfit)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
