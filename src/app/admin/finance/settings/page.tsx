import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listSettings } from "@/actions/accounting/settings";
import { SettingEditor } from "@/components/admin/SettingEditor";

export const dynamic = "force-dynamic";

type InferredType = "string" | "number" | "boolean" | "json";

function inferType(v: unknown): InferredType {
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    return "json";
}

function groupKey(key: string): string {
    return key.split(".")[0] ?? "misc";
}

const groupLabels: Record<string, string> = {
    tax: "Pajak",
    entity: "Entitas / PKP",
    period: "Periode Akuntansi",
    fee: "Fee Platform",
    refund: "Refund",
    payout: "Payout",
    affiliate: "Affiliate",
    report: "Laporan",
    seller_export: "Export Seller",
    gl: "General Ledger",
    recon: "Rekonsiliasi",
    isolation: "Isolation",
    audit: "Audit",
    rbac: "RBAC",
    rounding: "Rounding",
    misc: "Lain-lain",
};

export default async function AdminFinanceSettingsPage() {
    await requireAdminFinanceSession();
    const all = await listSettings("GLOBAL");
    type Row = (typeof all)[number];

    // Group by prefix
    const groups = new Map<string, Row[]>();
    for (const row of all) {
        const g = groupKey(row.key);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(row);
    }
    const sortedGroups = Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Finance
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Settings Akuntansi
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Setiap perubahan disimpan sebagai versi baru dengan effective_from. Nilai lama tetap tersimpan
                        untuk reproducibility laporan historis. Total {all.length} setting aktif.
                    </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <strong>Hati-hati:</strong> mengubah <code>tax.ppn_rate</code>, <code>entity.is_pkp</code>,
                    atau parameter posting akan langsung memengaruhi journal yang baru dibuat. Lihat
                    <code> getSettingHistory()</code> untuk audit trail.
                </div>

                {sortedGroups.map(([g, rows]) => (
                    <section key={g} className="rounded-2xl border border-slate-200 bg-white">
                        <header className="border-b border-slate-200 px-5 py-3">
                            <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
                                {groupLabels[g] ?? g}
                            </h2>
                            <p className="text-xs text-slate-500">{rows.length} setting</p>
                        </header>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Key</th>
                                        <th className="px-4 py-2 text-left">Value</th>
                                        <th className="px-4 py-2 text-left">Effective From</th>
                                        <th className="px-4 py-2 text-left">Updated</th>
                                        <th className="px-4 py-2 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((r) => {
                                        const t = inferType(r.value);
                                        return (
                                            <tr key={r.key}>
                                                <td className="px-4 py-2 font-mono text-xs">{r.key}</td>
                                                <td className="px-4 py-2 font-mono text-xs">
                                                    {t === "json" ? (
                                                        <code className="rounded bg-slate-100 px-1.5 py-0.5">{JSON.stringify(r.value)}</code>
                                                    ) : (
                                                        <code className="rounded bg-slate-100 px-1.5 py-0.5">{String(r.value)}</code>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-slate-500">{String(r.effective_from)}</td>
                                                <td className="px-4 py-2 text-xs text-slate-500">
                                                    {new Date(r.updated_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <SettingEditor
                                                        settingKey={r.key}
                                                        currentValue={r.value}
                                                        inferredType={t}
                                                        notes={r.notes}
                                                        effectiveFrom={String(r.effective_from)}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}
