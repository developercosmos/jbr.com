import Link from "next/link";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { recordReceiptAction } from "@/actions/accounting/inventory-admin";

export const dynamic = "force-dynamic";

interface ItemOption {
    id: string;
    sku: string;
    name: string;
}

export default async function NewReceiptPage(props: {
    searchParams: Promise<{ error?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;

    let items: ItemOption[] = [];
    let migrationOk = true;
    let errMsg: string | null = null;
    try {
        const rows = await db.execute(sql`
            SELECT id, sku, name FROM inventory_items WHERE is_active = true
            ORDER BY sku LIMIT 500
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
                        Catat Receipt (GR / Pembelian)
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Posting otomatis: <code>DR 13100 (Persediaan)</code> / <code>CR 21100 (Utang Vendor)</code> atau{" "}
                        <code>CR 11100 (Kas)</code> jika tunai.
                    </p>
                </div>

                {!migrationOk ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        Migrasi inventory belum diterapkan. {errMsg}
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        Belum ada item aktif.{" "}
                        <Link href="/admin/finance/inventory/items/new" className="underline font-semibold">
                            Tambah item dulu
                        </Link>
                        .
                    </div>
                ) : (
                    <form action={recordReceiptAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
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
                                        {i.sku} — {i.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <NumField label="Qty" name="qty" required step="0.01" />
                            <NumField label="Unit Cost (IDR)" name="unit_cost" required step="0.01" />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Mode Pembayaran
                            </label>
                            <select
                                name="payment_mode"
                                defaultValue="CREDIT"
                                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                            >
                                <option value="CREDIT">CREDIT — Utang Vendor (21100)</option>
                                <option value="CASH">CASH — Kas/Bank (11100)</option>
                            </select>
                        </div>

                        <TxtField label="Ref Type" name="ref_type" defaultValue="PURCHASE_ORDER" />
                        <TxtField label="Ref ID (No. PO/Invoice)" name="ref_id" />
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Tanggal (opsional, default: now)
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
                                Posting Receipt
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

function NumField({ label, name, required, step }: { label: string; name: string; required?: boolean; step?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </label>
            <input
                type="number"
                name={name}
                required={required}
                step={step ?? "1"}
                min="0"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
            />
        </div>
    );
}

function TxtField({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</label>
            <input
                type="text"
                name={name}
                defaultValue={defaultValue}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
        </div>
    );
}
