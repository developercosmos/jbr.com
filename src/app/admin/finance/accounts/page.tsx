import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listAllCoaAccounts } from "@/actions/accounting/coa";
import CoaManager from "@/components/admin/CoaManager";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
    await requireAdminFinanceSession();
    const accounts = await listAllCoaAccounts();

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance" className="text-sm text-brand-primary hover:underline">
                        ← Finance
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Chart of Accounts (Daftar Akun)
                    </h1>
                    <p className="mt-1 text-slate-600">
                        Kelola akun GL. Konvensi kode: 1=Aset, 2=Liabilitas, 3=Ekuitas, 4=Pendapatan,
                        5=HPP, 6=Beban. Akun yang sudah dipakai di jurnal hanya bisa diubah nama/deskripsi.
                    </p>
                </header>

                <CoaManager accounts={accounts} />

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                    Saldo normal otomatis mengikuti kelas akun (mis. ASSET = DEBIT, REVENUE = CREDIT).
                    Kode harus unik. Untuk mencegah korupsi histori, kode/kelas/saldo-normal tidak dapat
                    diubah setelah akun dipakai di jurnal — buat akun baru bila perlu reklasifikasi.
                </div>
            </div>
        </div>
    );
}
