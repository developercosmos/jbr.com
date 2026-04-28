import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { createInventoryItemAction } from "@/actions/accounting/inventory-admin";

export const dynamic = "force-dynamic";

export default async function NewInventoryItemPage(props: {
    searchParams: Promise<{ error?: string }>;
}) {
    await requireAdminFinanceSession();
    const sp = await props.searchParams;

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance/inventory" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Inventory
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Tambah Item Inventory 1P
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Master record untuk barang first-party. Posting GL akan menggunakan akun 13100 (Persediaan).
                    </p>
                </div>

                <form action={createInventoryItemAction} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                    {sp.error ? (
                        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
                            {sp.error}
                        </div>
                    ) : null}
                    <Field label="SKU" name="sku" required placeholder="SKU-001" />
                    <Field label="Nama Item" name="name" required placeholder="Spek raket badminton ABC" />
                    <Field label="Product ID (opsional)" name="product_id" placeholder="UUID dari tabel products" />
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Cost Method
                        </label>
                        <select
                            name="cost_method"
                            defaultValue="MOVING_AVG"
                            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                        >
                            <option value="MOVING_AVG">MOVING_AVG (default)</option>
                            <option value="FIFO" disabled>FIFO (belum diimplementasi)</option>
                        </select>
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
                            Simpan Item
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function Field({ label, name, required, placeholder }: { label: string; name: string; required?: boolean; placeholder?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                {label}{required ? <span className="text-red-500"> *</span> : null}
            </label>
            <input
                type="text"
                name={name}
                required={required}
                placeholder={placeholder}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
        </div>
    );
}
