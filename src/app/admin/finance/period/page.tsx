import Link from "next/link";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import {
    listPeriodsWithStats,
    lockPeriodAction,
    reopenPeriodAction,
} from "@/actions/accounting/periods";

export const dynamic = "force-dynamic";

const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtIDR(s: string | number): string {
    const n = typeof s === "string" ? Number(s) : s;
    if (!Number.isFinite(n)) return "-";
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const STATUS_PILL: Record<string, string> = {
    OPEN: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    LOCKED: "bg-amber-50 text-amber-700 ring-amber-200",
    CLOSED: "bg-slate-100 text-slate-700 ring-slate-300",
};

export default async function PeriodLifecyclePage() {
    await requireAdminFinanceReader();
    const periods = await listPeriodsWithStats("PLATFORM");

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance" className="text-sm text-brand-primary hover:underline">
                        ← Finance
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Periode Akuntansi
                    </h1>
                    <p className="mt-1 text-slate-600">
                        Lifecycle: <b>OPEN → LOCKED → CLOSED</b>. Periode CLOSED dibekukan dan menjadi
                        sumber laporan final.
                    </p>
                </header>

                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>
                                <th className="px-4 py-3 text-left">Periode</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-right">Jurnal</th>
                                <th className="px-4 py-3 text-right">Total Debit</th>
                                <th className="px-4 py-3 text-right">Total Kredit</th>
                                <th className="px-4 py-3 text-right">Drift</th>
                                <th className="px-4 py-3 text-left">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {periods.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-6 text-slate-500" colSpan={7}>
                                        Belum ada periode. Periode akan otomatis dibuat saat posting jurnal pertama.
                                    </td>
                                </tr>
                            ) : (
                                periods.map((p) => {
                                    const drift =
                                        Math.round((Number(p.debit_total) - Number(p.credit_total)) * 100) / 100;
                                    const balanced = Math.abs(drift) < 0.01;
                                    return (
                                        <tr key={p.id} className="border-t border-slate-100">
                                            <td className="px-4 py-3 font-mono">
                                                {monthNames[p.month]} {p.year}
                                                <div className="text-xs text-slate-400">
                                                    {p.starts_at} → {p.ends_at}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${STATUS_PILL[p.status] ?? ""}`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">{p.journals_count}</td>
                                            <td className="px-4 py-3 text-right font-mono">{fmtIDR(p.debit_total)}</td>
                                            <td className="px-4 py-3 text-right font-mono">{fmtIDR(p.credit_total)}</td>
                                            <td className={`px-4 py-3 text-right font-mono ${balanced ? "text-emerald-600" : "text-red-600 font-bold"}`}>
                                                {fmtIDR(drift)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-2">
                                                    {p.status === "OPEN" && (
                                                        <form action={lockPeriodAction}>
                                                            <input type="hidden" name="period_id" value={p.id} />
                                                            <button
                                                                type="submit"
                                                                className="rounded-md bg-amber-100 text-amber-800 px-2.5 py-1 text-xs font-medium hover:bg-amber-200"
                                                            >
                                                                Lock
                                                            </button>
                                                        </form>
                                                    )}
                                                    {p.status !== "CLOSED" && (
                                                        <Link
                                                            href={`/admin/finance/period/${p.id}/close`}
                                                            className="rounded-md bg-slate-900 text-white px-2.5 py-1 text-xs font-medium hover:bg-slate-700"
                                                        >
                                                            Close Wizard →
                                                        </Link>
                                                    )}
                                                    {p.status !== "OPEN" && (
                                                        <form action={reopenPeriodAction}>
                                                            <input type="hidden" name="period_id" value={p.id} />
                                                            <button
                                                                type="submit"
                                                                className="rounded-md bg-white text-red-700 ring-1 ring-red-200 px-2.5 py-1 text-xs font-medium hover:bg-red-50"
                                                            >
                                                                Re-open
                                                            </button>
                                                        </form>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    <b className="text-slate-900">Catatan:</b> Re-open periode CLOSED hanya boleh
                    dilakukan oleh ADMIN dengan justifikasi tertulis. Semua perubahan status periode
                    tercatat di kolom <code>locked_by / closed_by</code>.
                </div>
            </div>
        </div>
    );
}
