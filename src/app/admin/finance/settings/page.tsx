import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listSettings } from "@/actions/accounting/settings";
import SettingsBrowser from "./SettingsBrowser";

export const dynamic = "force-dynamic";

export default async function AdminFinanceSettingsPage() {
    await requireAdminFinanceSession();
    const all = await listSettings("GLOBAL");

    const rows = all.map((r) => ({
        key: r.key,
        value: r.value,
        notes: r.notes,
        effective_from: String(r.effective_from),
        updated_at: r.updated_at as unknown as string,
    }));

    return (
        <div className="flex-1 p-6 sm:p-8 bg-slate-50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Finance
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900 mt-1">
                        Settings Akuntansi
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Setiap perubahan disimpan sebagai versi baru dengan <code className="text-xs">effective_from</code>.
                        Nilai lama tetap tersimpan untuk reproducibility laporan historis. Total <strong>{all.length}</strong>{" "}
                        setting aktif.
                    </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                    <span className="font-bold">Hati-hati:</span>
                    <span>
                        mengubah <code>tax.ppn_rate</code>, <code>entity.is_pkp</code>, atau parameter posting akan langsung
                        memengaruhi journal yang dibuat setelah simpan. Klik label setiap setting untuk melihat dampak detailnya
                        sebelum mengubah.
                    </span>
                </div>

                <SettingsBrowser rows={rows} />
            </div>
        </div>
    );
}
