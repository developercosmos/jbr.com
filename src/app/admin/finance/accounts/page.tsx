import Link from "next/link";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { listAllCoaAccounts } from "@/actions/accounting/coa";
import { getAccountMap } from "@/actions/accounting/account-map";
import CoaManager from "@/components/admin/CoaManager";
import AccountMappingManager from "@/components/admin/AccountMappingManager";

export const dynamic = "force-dynamic";

export default async function ChartOfAccountsPage() {
    await requireAdminFinanceSession();
    const accounts = await listAllCoaAccounts();
    const mapping = await getAccountMap();
    const postableAccounts = accounts.filter((a) => a.isActive && a.isPostable);

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-10">
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

                <section className="space-y-4">
                    <header>
                        <h2 className="text-xl font-heading font-bold uppercase tracking-tight text-slate-900">
                            Pemetaan Akun Transaksi
                        </h2>
                        <p className="mt-1 text-slate-600">
                            Tentukan akun GL yang dipakai setiap jenis transaksi otomatis (pembayaran,
                            release escrow, payout, fee, refund, affiliate, inventory 1P). Selama tidak
                            diubah, sistem memakai akun <strong>default</strong> bawaan — jadi mengubah di sini
                            <em> tidak</em> memengaruhi jurnal yang sudah terposting, hanya jurnal berikutnya.
                            Hanya akun aktif &amp; postable yang bisa dipilih.
                        </p>
                    </header>

                    <AccountMappingManager slots={mapping} accounts={postableAccounts} />
                </section>
            </div>
        </div>
    );
}
