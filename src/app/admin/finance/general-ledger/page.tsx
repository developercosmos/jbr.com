import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { getGlForAccount, getTrialBalance } from "@/actions/accounting/reports";
import { formatIdr } from "@/lib/format-idr";

export const dynamic = "force-dynamic";

function defaultRange() {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default async function AdminGeneralLedgerPage(props: {
    searchParams: Promise<{ account?: string; from?: string; to?: string; book?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const def = defaultRange();
    const fromStr = sp.from ?? def.from;
    const toStr = sp.to ?? def.to;
    const book = (sp.book === "SELLER" ? "SELLER" : "PLATFORM") as "PLATFORM" | "SELLER";
    const accountCode = sp.account ?? "";

    const tb = await getTrialBalance({ book }); // for account picker
    const detail = accountCode
        ? await getGlForAccount({
              accountCode,
              from: new Date(`${fromStr}T00:00:00`),
              to: new Date(`${toStr}T23:59:59`),
              book,
          })
        : null;

    const exportHref = accountCode
        ? `/api/admin/finance/export/general-ledger?account=${encodeURIComponent(accountCode)}&from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&book=${book}`
        : null;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">&larr; Finance</Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">General Ledger</h1>
                    </div>
                    {exportHref && (
                        <Link href={exportHref} className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
                            <Download className="w-4 h-4" /> Export CSV
                        </Link>
                    )}
                </div>

                <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <label className="flex flex-col text-xs font-medium text-slate-600">
                        Akun
                        <select name="account" defaultValue={accountCode} className="mt-1 min-w-[280px] rounded-md border border-slate-300 px-3 py-1.5 text-sm">
                            <option value="">— pilih akun —</option>
                            {tb.rows.map((r) => (
                                <option key={r.code} value={r.code}>{r.code} — {r.name}</option>
                            ))}
                        </select>
                    </label>
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

                {!detail && (
                    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500">
                        Pilih akun untuk melihat mutasi.
                    </div>
                )}

                {detail && detail.account && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">{detail.account.class} • {detail.account.normalBalance}</p>
                                <h2 className="font-heading text-lg font-bold uppercase tracking-tight">
                                    {detail.account.code} — {detail.account.name}
                                </h2>
                            </div>
                            <div className="text-right text-xs text-slate-600">
                                <div>Saldo Awal: <span className="font-mono font-semibold">{formatIdr(detail.openingBalance)}</span></div>
                                <div>Saldo Akhir: <span className="font-mono font-semibold">{formatIdr(detail.closingBalance)}</span></div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Tanggal</th>
                                        <th className="px-4 py-2 text-left">No</th>
                                        <th className="px-4 py-2 text-left">Deskripsi</th>
                                        <th className="px-4 py-2 text-left">Ref</th>
                                        <th className="px-4 py-2 text-right">Debit</th>
                                        <th className="px-4 py-2 text-right">Kredit</th>
                                        <th className="px-4 py-2 text-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {detail.rows.map((r) => (
                                        <tr key={r.journalId + r.journalNo}>
                                            <td className="px-4 py-1.5 font-mono text-xs">{r.postedAt.slice(0, 10)}</td>
                                            <td className="px-4 py-1.5 font-mono text-xs">{r.journalNo}</td>
                                            <td className="px-4 py-1.5">{r.description}</td>
                                            <td className="px-4 py-1.5 text-xs text-slate-500">{r.refType ? `${r.refType}:${(r.refId ?? "").slice(0, 8)}…` : "-"}</td>
                                            <td className="px-4 py-1.5 text-right font-mono">{r.debit ? formatIdr(r.debit) : "-"}</td>
                                            <td className="px-4 py-1.5 text-right font-mono">{r.credit ? formatIdr(r.credit) : "-"}</td>
                                            <td className="px-4 py-1.5 text-right font-mono font-semibold">{formatIdr(r.runningBalance)}</td>
                                        </tr>
                                    ))}
                                    {detail.rows.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Tidak ada mutasi pada periode ini.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
