import Link from "next/link";
import { History } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { listFinanceAudit } from "@/actions/accounting/audit";

export const dynamic = "force-dynamic";

const ACTION_OPTIONS = [
    "",
    "SETTING_UPDATE",
    "PERIOD_LOCK",
    "PERIOD_CLOSE",
    "PERIOD_REOPEN",
    "JOURNAL_MANUAL_POST",
    "INVENTORY_RECEIPT",
    "INVENTORY_COGS",
    "INVENTORY_ADJUSTMENT",
];

function badgeClass(action: string): string {
    if (action.startsWith("PERIOD")) return "bg-amber-100 text-amber-800";
    if (action.startsWith("JOURNAL")) return "bg-indigo-100 text-indigo-800";
    if (action.startsWith("INVENTORY")) return "bg-emerald-100 text-emerald-800";
    if (action === "SETTING_UPDATE") return "bg-sky-100 text-sky-800";
    return "bg-slate-100 text-slate-700";
}

export default async function AdminFinanceAuditPage(props: {
    searchParams: Promise<{ action?: string; limit?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const action = sp.action?.trim() || undefined;
    const limit = Math.min(Math.max(parseInt(sp.limit ?? "200", 10) || 200, 25), 500);
    const entries = await listFinanceAudit({ action, limit });

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Finance
                    </Link>
                    <div className="flex items-center gap-3 mt-1">
                        <History className="w-6 h-6 text-brand-primary" />
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Audit Log Keuangan
                        </h1>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                        Semua perubahan setting akuntansi, periode, jurnal manual, dan mutasi inventory 1P.
                        Hanya admin keuangan yang dapat melihat halaman ini.
                    </p>
                </div>

                <form className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Action
                        </label>
                        <select
                            name="action"
                            defaultValue={action ?? ""}
                            className="mt-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        >
                            {ACTION_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                    {o || "— semua —"}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Limit
                        </label>
                        <input
                            type="number"
                            name="limit"
                            min={25}
                            max={500}
                            defaultValue={limit}
                            className="mt-1 w-24 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-md bg-brand-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-primary/90"
                    >
                        Filter
                    </button>
                </form>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Waktu</th>
                                <th className="px-3 py-2 text-left">Action</th>
                                <th className="px-3 py-2 text-left">Aktor</th>
                                <th className="px-3 py-2 text-left">Target</th>
                                <th className="px-3 py-2 text-left">Payload</th>
                                <th className="px-3 py-2 text-left">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {entries.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                        Tidak ada catatan audit untuk filter ini.
                                    </td>
                                </tr>
                            ) : (
                                entries.map((e) => (
                                    <tr key={e.id} className="align-top">
                                        <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                                            {new Date(e.occurredAt).toLocaleString("id-ID")}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${badgeClass(e.action)}`}>
                                                {e.action}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            <div className="font-mono text-slate-700">{e.actorEmail ?? "—"}</div>
                                            {e.actorId ? (
                                                <div className="font-mono text-[10px] text-slate-400">{e.actorId}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2 text-xs">
                                            <div className="text-slate-600">{e.targetType ?? "—"}</div>
                                            {e.targetId ? (
                                                <div className="font-mono text-[10px] text-slate-500">{e.targetId}</div>
                                            ) : null}
                                        </td>
                                        <td className="px-3 py-2">
                                            <details>
                                                <summary className="cursor-pointer text-xs text-brand-primary">
                                                    lihat
                                                </summary>
                                                <pre className="mt-1 max-w-md overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">
                                                    {JSON.stringify(e.payload, null, 2)}
                                                </pre>
                                            </details>
                                        </td>
                                        <td className="px-3 py-2 font-mono text-[10px] text-slate-500">
                                            {e.ip ?? "—"}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="text-xs text-slate-500">
                    Menampilkan {entries.length} entri terbaru. Audit log bersifat append-only dan tidak boleh dihapus.
                </p>
            </div>
        </div>
    );
}
