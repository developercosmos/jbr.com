import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { accounting_periods } from "@/db/schema-accounting";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { closePeriodAction, getCloseChecklist } from "@/actions/accounting/periods";

export const dynamic = "force-dynamic";

const monthNames = [
    "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtIDR(n: number): string {
    return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function ClosePeriodWizardPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAdminFinanceSession();
    const { id } = await params;
    const rows = await db.select().from(accounting_periods).where(eq(accounting_periods.id, id)).limit(1);
    const period = rows[0];
    if (!period) notFound();

    const checklist = await getCloseChecklist(id);
    const canClose = checklist.balanced && period.status !== "CLOSED";

    const items: { ok: boolean | "warn"; label: string; detail?: string }[] = [
        {
            ok: checklist.balanced,
            label: "Trial Balance balanced (debit = kredit)",
            detail: `Debit ${fmtIDR(checklist.debitTotal)} − Kredit ${fmtIDR(checklist.creditTotal)} = drift ${fmtIDR(checklist.drift)}`,
        },
        {
            ok: checklist.journalsCount > 0,
            label: "Periode memiliki jurnal POSTED",
            detail: `${checklist.journalsCount} jurnal pada ${checklist.accountsWithBalance} akun`,
        },
        {
            ok: period.status !== "CLOSED",
            label: "Periode belum CLOSED",
            detail: period.status === "CLOSED" ? `Sudah ditutup pada ${period.closed_at?.toString()}` : "Status saat ini: " + period.status,
        },
        {
            ok: checklist.nextPeriodOpen ? true : "warn",
            label: "Periode berikutnya OPEN (untuk auto-posting setelah closing)",
            detail: checklist.nextPeriodOpen ? "OK" : "Periode berikutnya belum dibuat / tidak OPEN — auto-posting akan auto-create OPEN saat dibutuhkan.",
        },
    ];

    return (
        <div className="flex-1 p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <header>
                    <Link href="/admin/finance/period" className="text-sm text-brand-primary hover:underline">
                        ← Periode
                    </Link>
                    <h1 className="mt-2 text-2xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Close Wizard — {monthNames[period.month]} {period.year}
                    </h1>
                    <p className="mt-1 text-slate-600">
                        Periksa checklist berikut sebelum menutup periode. Setelah CLOSED periode tidak
                        dapat menerima jurnal baru kecuali di-reopen oleh ADMIN.
                    </p>
                </header>

                <div className="rounded-xl border border-slate-200 bg-white">
                    <ul className="divide-y divide-slate-100">
                        {items.map((it, i) => (
                            <li key={i} className="flex items-start gap-3 p-4">
                                {it.ok === true ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                                ) : it.ok === "warn" ? (
                                    <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                )}
                                <div className="text-sm">
                                    <div className="font-medium text-slate-900">{it.label}</div>
                                    {it.detail && <div className="mt-0.5 text-slate-500">{it.detail}</div>}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <b>Hal yang TIDAK dilakukan otomatis</b> oleh wizard ini (kerjakan terlebih dahulu
                    sebagai jurnal manual jika relevan):
                    <ul className="mt-2 ml-4 list-disc space-y-1">
                        <li>Bank reconciliation (match <code>bank_statement_lines</code>).</li>
                        <li>Adjusting entries (akrual, prepaid, depresiasi PSAK 16).</li>
                        <li>Posting beban PPh Badan (PSAK 46) → 81000 vs 24600.</li>
                        <li>Closing entry (rev/exp → retained earnings) — opsional, P&L laporan sudah otomatis menghitung laba berjalan.</li>
                        <li>Snapshot TB / PL / BS ke <code>period_snapshots</code> (tabel snapshot belum diimplementasi — tahap berikutnya).</li>
                    </ul>
                </div>

                <form action={closePeriodAction} className="flex items-center justify-end gap-3">
                    <input type="hidden" name="period_id" value={period.id} />
                    <Link
                        href="/admin/finance/period"
                        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                    >
                        Batal
                    </Link>
                    <button
                        type="submit"
                        disabled={!canClose}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                        {period.status === "CLOSED" ? "Sudah CLOSED" : canClose ? "Tutup Periode (CLOSED)" : "Tidak dapat ditutup — perbaiki checklist"}
                    </button>
                </form>
            </div>
        </div>
    );
}
