import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listPostableAccounts } from "@/actions/accounting/manual-journal";
import ManualJournalForm from "@/components/admin/ManualJournalForm";

export const dynamic = "force-dynamic";

export default async function ManualJournalPage({
    searchParams,
}: {
    searchParams: Promise<{ ok?: string }>;
}) {
    await requireAdminFinanceSession();
    const accounts = await listPostableAccounts();
    const sp = await searchParams;

    return (
        <div className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance" className="text-sm text-brand-primary hover:underline">
                        ← Finance
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Jurnal Manual
                    </h1>
                    <p className="mt-1 text-slate-600">
                        Untuk adjusting entries (akrual, prepaid, depresiasi, koreksi). Akan otomatis
                        ditolak jika periode tujuan sudah <code>LOCKED</code> atau <code>CLOSED</code>.
                    </p>
                </header>

                <ManualJournalForm accounts={accounts} okJournalNo={sp.ok} />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    Aturan: minimal 2 baris, setiap baris hanya boleh debit ATAU kredit (bukan keduanya),
                    total debit harus sama dengan total kredit (toleransi 0.01 IDR), semua angka dalam IDR.
                    Source = <code>MANUAL</code>; idempotency key tidak digunakan (jurnal manual selalu
                    membuat row baru — re-submit akan menghasilkan jurnal duplikat).
                </div>
            </div>
        </div>
    );
}
