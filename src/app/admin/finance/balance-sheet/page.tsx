import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getBalanceSheet, type ProfitLossSection } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function SectionTable({ title, section, extra }: { title: string; section: ProfitLossSection; extra?: { label: string; value: number }[] }) {
    const total = section.subtotal + (extra?.reduce((s, e) => s + e.value, 0) ?? 0);
    return (
        <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">{title}</h2>
            </div>
            <table className="w-full">
                <tbody>
                    {section.rows.length === 0 && (!extra || extra.length === 0) && (
                        <tr>
                            <td colSpan={3} className="px-4 py-3 text-sm italic text-slate-400">Tidak ada saldo.</td>
                        </tr>
                    )}
                    {section.rows.map((r) => (
                        <tr key={r.code}>
                            <td className="px-4 py-1.5 font-mono text-xs text-slate-500">{r.code}</td>
                            <td className="px-4 py-1.5 text-sm">{r.name}</td>
                            <td className="px-4 py-1.5 text-right font-mono text-sm">{formatIdr(r.balance)}</td>
                        </tr>
                    ))}
                    {extra?.map((e) => (
                        <tr key={e.label}>
                            <td className="px-4 py-1.5 font-mono text-xs text-slate-500">—</td>
                            <td className="px-4 py-1.5 text-sm italic">{e.label}</td>
                            <td className="px-4 py-1.5 text-right font-mono text-sm">{formatIdr(e.value)}</td>
                        </tr>
                    ))}
                    <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={2} className="px-4 py-2 text-right text-xs font-bold uppercase tracking-wider">Total {title}</td>
                        <td className="px-4 py-2 text-right font-mono text-sm font-bold">{formatIdr(total)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export default async function AdminBalanceSheetPage(props: {
    searchParams: Promise<{ asOf?: string; book?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const asOfStr = sp.asOf ?? todayStr();
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const asOf = new Date(`${asOfStr}T23:59:59`);
    const bs = await getBalanceSheet({ asOf, book });

    const exportHref = `/api/admin/finance/export/balance-sheet?asOf=${encodeURIComponent(asOfStr)}&book=${book}`;
    const printHref = `/admin/finance/balance-sheet/print?asOf=${encodeURIComponent(asOfStr)}&book=${book}&auto=1`;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">&larr; Finance</Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">Neraca</h1>
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
                        Per Tanggal
                        <input type="date" name="asOf" defaultValue={asOfStr} className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm" />
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

                <div className={`rounded-lg border px-4 py-3 text-sm ${bs.balanced ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                    {bs.balanced ? "Balanced" : "NOT BALANCED"}: aset <strong>{formatIdr(bs.assets.subtotal)}</strong> vs liabilitas + ekuitas <strong>{formatIdr(bs.totalLiabilitiesAndEquity)}</strong>.
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    <SectionTable title="Aset" section={bs.assets} />
                    <div className="space-y-4">
                        <SectionTable title="Liabilitas" section={bs.liabilities} />
                        <SectionTable
                            title="Ekuitas"
                            section={bs.equity}
                            extra={[{ label: "Laba Ditahan (YTD)", value: bs.retainedEarningsYtd }]}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
