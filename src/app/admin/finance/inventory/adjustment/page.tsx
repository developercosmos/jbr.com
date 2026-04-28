import Link from "next/link";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { recordAdjustmentAction } from "@/actions/accounting/inventory-admin";

export const dynamic = "force-dynamic";

interface ItemOption {
    id: string;
    sku: string;
    name: string;
    on_hand_qty: string;
    avg_unit_cost: string;
}

export default async function NewAdjustmentPage(props: {
    searchParams: Promise<{ error?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;

    let items: ItemOption[] = [];
    let migrationOk = true;
    let errMsg: string | null = null;
    try {
        const rows = await db.execute(sql`
            SELECT id, sku, name, on_hand_qty::text, avg_unit_cost::text
            FROM inventory_items WHERE is_active = true ORDER BY sku LIMIT 500
        `);
        items = rows as unknown as ItemOption[];
    } catch (e) {
        migrationOk = false;
        errMsg = e instanceof Error ? e.message : String(e);
    }

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance/inventory" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Inventory
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Adjustment Inventory (Opname / Damage)
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Posting otomatis: positif → DR 13100 / CR 69000; negatif → DR 69000 / CR 13100.
                    </p>
                </div>

                {!migrationOk ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        Migrasi inventory belum diterapkan. {errMsg}
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        Belum ada item aktif.
                    </div>
                ) : (
                    <form action={recordAdjustmentAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                        {sp.error ? (
                            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                                {sp.error}
                            </div>
                        ) : null}
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Item <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="item_id"
                                required
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="">— pilih item —</option>
                                {items.map((i) => (
                                    <option key={i.id} value={i.id}>
                                        {i.sku} — {i.name} (on-hand: {Number(i.on_hand_qty).toFixed(2)}, avg: {Number(i.avg_unit_cost).toFixed(2)})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Reason <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="reason"
                                defaultValue="OPNAME_PLUS"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="OPNAME_PLUS">OPNAME_PLUS — found stock</option>
                                <option value="OPNAME_MINUS">OPNAME_MINUS — missing stock</option>
                                <option value="DAMAGE">DAMAGE — barang rusak</option>
                                <option value="WRITE_OFF">WRITE_OFF — pemusnahan</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Qty Delta <span className="text-red-500">*</span> (positif = tambah, negatif = kurang)
                            </label>
                            <input
                                type="number"
                                name="qty_delta"
                                required
                                step="0.01"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Unit Cost (untuk OPNAME_PLUS; default = avg saat ini)
                            </label>
                            <input
                                type="number"
                                name="unit_cost"
                                step="0.01"
                                min="0"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Tanggal (opsional)
                            </label>
                            <input
                                type="datetime-local"
                                name="occurred_at"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Memo
                            </label>
                            <textarea
                                name="memo"
                                rows={2}
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <Link
                                href="/admin/finance/inventory"
                                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                            >
                                Batal
                            </Link>
                            <button
                                type="submit"
                                className="rounded-md bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                            >
                                Posting Adjustment
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
