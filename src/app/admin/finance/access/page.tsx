import Link from "next/link";
import { ShieldCheck, Trash2 } from "lucide-react";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import {
    listFinanceViewers,
    grantFinanceViewerAction,
    revokeFinanceViewerAction,
} from "@/actions/accounting/finance-access";

export const dynamic = "force-dynamic";

export default async function FinanceAccessPage(props: {
    searchParams: Promise<{ error?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;
    const viewers = await listFinanceViewers();

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Finance
                    </Link>
                    <div className="mt-2 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-brand-primary" />
                        <h1 className="text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Akses Finance (FINANCE_VIEWER)
                        </h1>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                        User yang dimasukkan di sini bisa <b>melihat</b> laporan keuangan (TB, P&amp;L, Neraca,
                        GL, Audit Log, Inventory) tanpa role ADMIN. Akses tulis (settings, periode, jurnal manual,
                        receipt/adjustment) tetap admin-only.
                    </p>
                </div>

                {sp.error ? (
                    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                        {sp.error}
                    </div>
                ) : null}

                <form
                    action={grantFinanceViewerAction}
                    className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
                >
                    <div className="flex-1 min-w-[240px]">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Email user yang akan diberi akses
                        </label>
                        <input
                            type="email"
                            name="email"
                            required
                            placeholder="user@example.com"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        />
                    </div>
                    <button
                        type="submit"
                        className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                        + Beri Akses
                    </button>
                </form>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-3 py-2 text-left">Nama</th>
                                <th className="px-3 py-2 text-left">Email</th>
                                <th className="px-3 py-2 text-left">User ID</th>
                                <th className="px-3 py-2 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                                        Belum ada FINANCE_VIEWER.
                                    </td>
                                </tr>
                            ) : (
                                viewers.map((v) => (
                                    <tr key={v.id}>
                                        <td className="px-3 py-2">{v.name ?? "—"}</td>
                                        <td className="px-3 py-2 font-mono text-xs">{v.email ?? "—"}</td>
                                        <td className="px-3 py-2 font-mono text-[10px] text-slate-400">{v.id}</td>
                                        <td className="px-3 py-2 text-right">
                                            <form action={revokeFinanceViewerAction} className="inline">
                                                <input type="hidden" name="user_id" value={v.id} />
                                                <button
                                                    type="submit"
                                                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-3 h-3" /> Revoke
                                                </button>
                                            </form>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <p className="text-xs text-slate-500">
                    Daftar disimpan pada accounting_settings <code>finance.viewer_user_ids</code> (JSON).
                    Setiap perubahan tercatat di Audit Log dengan action <code>FINANCE_ACCESS_GRANT</code> /{" "}
                    <code>FINANCE_ACCESS_REVOKE</code>.
                </p>
            </div>
        </div>
    );
}
