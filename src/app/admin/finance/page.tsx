import Link from "next/link";
import { Calculator, FileBarChart, Scale, BookOpen, Download, ShieldCheck, Settings as SettingsIcon, CalendarClock, NotebookPen, Banknote, Store, Package, History } from "lucide-react";
import { requireAdminFinanceSession } from "@/lib/admin-finance";

export const dynamic = "force-dynamic";

const cards = [
    {
        href: "/admin/finance/trial-balance",
        title: "Trial Balance",
        desc: "Saldo seluruh akun pada periode tertentu untuk memastikan debit = kredit.",
        icon: Calculator,
    },
    {
        href: "/admin/finance/profit-loss",
        title: "Laba Rugi (P&L)",
        desc: "Pendapatan, beban, dan laba bersih untuk periode terpilih (PSAK 1).",
        icon: FileBarChart,
    },
    {
        href: "/admin/finance/balance-sheet",
        title: "Neraca (Balance Sheet)",
        desc: "Posisi aset, liabilitas, dan ekuitas pada tanggal tertentu (PSAK 1).",
        icon: Scale,
    },
    {
        href: "/admin/finance/general-ledger",
        title: "General Ledger",
        desc: "Detail mutasi per akun lengkap dengan saldo berjalan.",
        icon: BookOpen,
    },
    {
        href: "/admin/finance/verify",
        title: "Integrity Check",
        desc: "Verifikasi balance journal, periode, dan rekonsiliasi legacy ledger.",
        icon: ShieldCheck,
    },
    {
        href: "/admin/finance/settings",
        title: "Settings Akuntansi",
        desc: "Atur tarif PPN, status PKP, fiscal year, dan parameter posting lain.",
        icon: SettingsIcon,
    },
    {
        href: "/admin/finance/period",
        title: "Periode & Closing",
        desc: "Lifecycle OPEN → LOCKED → CLOSED. Wizard tutup buku & re-open.",
        icon: CalendarClock,
    },
    {
        href: "/admin/finance/journals/new",
        title: "Jurnal Manual",
        desc: "Posting adjusting entries (akrual, depresiasi, koreksi) dengan validasi balance.",
        icon: NotebookPen,
    },
    {
        href: "/admin/finance/affiliate-ledger",
        title: "Sub-Ledger Affiliate",
        desc: "Saldo wallet komisi per affiliate (akun 22200) + YTD pajak dipotong.",
        icon: Banknote,
    },
    {
        href: "/admin/finance/seller-ledger",
        title: "Sub-Ledger Seller",
        desc: "Saldo wallet seller (akun 22000), gross sales, komisi platform & payouts YTD.",
        icon: Store,
    },
    {
        href: "/admin/finance/inventory",
        title: "Inventory 1P",
        desc: "Persediaan barang first-party (akun 13100) dan HPP 1P (51100). Metode kos MOVING_AVG.",
        icon: Package,
    },
    {
        href: "/admin/finance/audit",
        title: "Audit Log",
        desc: "Riwayat perubahan setting, periode, jurnal manual, dan inventory oleh admin keuangan.",
        icon: History,
    },
];

export default async function AdminFinancePage() {
    await requireAdminFinanceSession();

    return (
        <div className="flex-1 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <header>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        Finance & General Ledger
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Laporan keuangan PSAK-compliant. Semua angka berasal dari journal POSTED.
                    </p>
                </header>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cards.map((c) => (
                        <Link
                            key={c.href}
                            href={c.href}
                            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-brand-primary hover:shadow-md"
                        >
                            <div className="flex items-center gap-3">
                                <span className="rounded-xl bg-brand-primary/10 p-2 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition">
                                    <c.icon className="w-5 h-5" />
                                </span>
                                <h2 className="font-heading text-lg font-bold uppercase tracking-tight text-slate-900">
                                    {c.title}
                                </h2>
                            </div>
                            <p className="mt-3 text-sm text-slate-600">{c.desc}</p>
                        </Link>
                    ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <div className="flex items-center gap-3">
                        <Download className="w-5 h-5 text-slate-500" />
                        <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
                            Export
                        </h2>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                        Setiap laporan menyediakan tombol unduh CSV pada masing-masing halaman.
                        Format CSV menggunakan UTF-8 BOM agar kompatibel dengan Excel Indonesia.
                    </p>
                </div>
            </div>
        </div>
    );
}
