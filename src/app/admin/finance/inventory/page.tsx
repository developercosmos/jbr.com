import Link from "next/link";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { requireAdminFinanceSession } from "@/lib/admin-finance";

export const dynamic = "force-dynamic";

interface ItemRow {
    id: string;
    sku: string;
    name: string;
    on_hand_qty: string;
    avg_unit_cost: string;
    on_hand_value: string;
    cost_method: string;
    is_active: boolean;
}

interface MovementRow {
    id: string;
    item_id: string;
    sku: string;
    name: string;
    kind: string;
    qty: string;
    unit_cost: string;
    total_cost: string;
    occurred_at: string;
    memo: string | null;
}

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function InventoryDashboardPage() {
    await requireAdminFinanceSession();

    let items: ItemRow[] = [];
    let movements: MovementRow[] = [];
    let migrationApplied = true;
    let errMsg: string | null = null;

    try {
        const itemRows = await db.execute(sql`
            SELECT id, sku, name, on_hand_qty::text, avg_unit_cost::text, on_hand_value::text,
                   cost_method::text, is_active
            FROM inventory_items
            ORDER BY is_active DESC, sku
            LIMIT 100
        `);
        items = itemRows as unknown as ItemRow[];

        const movRows = await db.execute(sql`
            SELECT m.id, m.item_id, i.sku, i.name, m.kind::text,
                   m.qty::text, m.unit_cost::text, m.total_cost::text,
                   m.occurred_at, m.memo
            FROM inventory_movements m
            JOIN inventory_items i ON i.id = m.item_id
            ORDER BY m.occurred_at DESC
            LIMIT 50
        `);
        movements = movRows as unknown as MovementRow[];
    } catch (e) {
        migrationApplied = false;
        errMsg = e instanceof Error ? e.message : String(e);
    }

    const totalValue = items.reduce((s, i) => s + Number(i.on_hand_value), 0);
    const totalSkus = items.filter((i) => i.is_active).length;

    return (
        <div className="flex-1 p-6 sm:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance" className="text-sm text-brand-primary hover:underline">
                        ← Finance Hub
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Inventory 1P (Persediaan)
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                        Sub-ledger persediaan barang first-party. Akun GL: <code>13100</code> Persediaan,
                        <code className="ml-1">21100</code> Utang Vendor, <code className="ml-1">51100</code> HPP 1P.
                        Metode kos: MOVING_AVG.
                    </p>
                </header>

                {!migrationApplied && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                        <b>Migrasi belum diterapkan.</b> Jalankan migrasi
                        <code className="mx-1">drizzle/0020_inventory_cogs.sql</code> di environment ini
                        untuk membuat tabel <code>inventory_items</code> &amp; <code>inventory_movements</code>
                        + seed COA 13100/21100/51100.
                        <div className="mt-2 text-xs text-amber-700">{errMsg}</div>
                    </div>
                )}

                {migrationApplied && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Stat label="SKU Aktif" value={String(totalSkus)} />
                            <Stat label="Nilai Persediaan (13100)" value={`Rp ${fmtIDR(totalValue)}`} highlight />
                            <Stat label="Movements (50 Terakhir)" value={String(movements.length)} />
                        </div>

                        <section>
                            <h2 className="text-lg font-bold text-slate-900 mb-2">Master Item (top 100)</h2>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">SKU</th>
                                            <th className="px-3 py-2 text-left">Nama</th>
                                            <th className="px-3 py-2 text-right">On-Hand Qty</th>
                                            <th className="px-3 py-2 text-right">Avg Cost</th>
                                            <th className="px-3 py-2 text-right">Nilai</th>
                                            <th className="px-3 py-2 text-left">Metode</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr><td className="px-3 py-6 text-slate-500" colSpan={6}>Belum ada item.</td></tr>
                                        ) : items.map((i) => (
                                            <tr key={i.id} className={`border-t border-slate-100 ${i.is_active ? "" : "opacity-50"}`}>
                                                <td className="px-3 py-2 font-mono">{i.sku}</td>
                                                <td className="px-3 py-2">{i.name}</td>
                                                <td className="px-3 py-2 text-right font-mono">{Number(i.on_hand_qty).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtIDR(Number(i.avg_unit_cost))}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtIDR(Number(i.on_hand_value))}</td>
                                                <td className="px-3 py-2 text-xs">{i.cost_method}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-lg font-bold text-slate-900 mb-2">Movements Terbaru</h2>
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Tanggal</th>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-left">Kind</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Unit Cost</th>
                                            <th className="px-3 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movements.length === 0 ? (
                                            <tr><td className="px-3 py-6 text-slate-500" colSpan={6}>Belum ada mutasi.</td></tr>
                                        ) : movements.map((m) => (
                                            <tr key={m.id} className="border-t border-slate-100">
                                                <td className="px-3 py-2 text-xs">{new Date(m.occurred_at).toLocaleString("id-ID")}</td>
                                                <td className="px-3 py-2"><span className="font-mono text-xs">{m.sku}</span> {m.name}</td>
                                                <td className="px-3 py-2 text-xs">{m.kind}</td>
                                                <td className="px-3 py-2 text-right font-mono">{Number(m.qty).toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtIDR(Number(m.unit_cost))}</td>
                                                <td className="px-3 py-2 text-right font-mono">{fmtIDR(Number(m.total_cost))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </>
                )}

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    <b>Phase 8 scope:</b> Read-only dashboard + posting helpers
                    (<code>postInventoryReceipt</code>, <code>postCogsOnSale</code>, <code>postInventoryAdjustment</code>).
                    UI untuk PO / GR / opname dan auto-posting COGS pada penjualan 1P akan
                    ditambahkan saat modul 1P enabled (depends on product flag <code>sale_kind=PRINCIPAL_1P</code>).
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className={`rounded-xl border p-4 ${highlight ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <div className="text-xs uppercase text-slate-500">{label}</div>
            <div className={`mt-1 font-mono font-bold ${highlight ? "text-emerald-700" : "text-slate-900"}`}>{value}</div>
        </div>
    );
}
