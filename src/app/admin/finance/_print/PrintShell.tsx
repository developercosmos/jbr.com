import { ReactNode } from "react";
import AutoPrint from "./AutoPrint";

const PRINT_STYLES = `
@page { size: A4; margin: 18mm 14mm 18mm 14mm; }
@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
  .print-page { padding: 0 !important; max-width: none !important; }
  table { page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
}
.print-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.print-table th, .print-table td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
.print-table thead th { background: #f1f5f9; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
.print-table .num { text-align: right; font-variant-numeric: tabular-nums; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.print-section { background: #f8fafc; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; }
.print-subtotal td { border-top: 1px solid #cbd5e1; font-weight: 600; }
.print-total td { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-weight: 800; font-size: 12px; background: #f1f5f9; }
`;

export default function PrintShell({
    title,
    subtitle,
    auto,
    children,
}: {
    title: string;
    subtitle?: string;
    auto: boolean;
    children: ReactNode;
}) {
    return (
        <div className="print-page mx-auto max-w-4xl bg-white p-8 text-slate-900">
            <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />
            <AutoPrint enabled={auto} />
            <div className="no-print mb-6 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span>
                    Tampilan cetak — gunakan tombol di bawah atau <kbd className="rounded border border-slate-300 bg-white px-1">Ctrl/⌘+P</kbd>{" "}
                    untuk menyimpan sebagai PDF.
                </span>
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
                >
                    Cetak / Simpan PDF
                </button>
            </div>
            <header className="mb-6 border-b-2 border-slate-900 pb-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Jualbeliraket — Laporan Keuangan
                </div>
                <h1 className="mt-1 text-2xl font-bold uppercase tracking-tight">{title}</h1>
                {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
                <p className="mt-2 text-[10px] text-slate-400">
                    Dicetak pada {new Date().toLocaleString("id-ID")}.
                </p>
            </header>
            <main>{children}</main>
            <footer className="mt-10 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
                Laporan ini dihasilkan otomatis dari journal POSTED. Sumber: General Ledger Jualbeliraket.
            </footer>
        </div>
    );
}

export function PrintBackButton({ href }: { href: string }) {
    // server component-friendly link rendered client-side via <a>
    return (
        <a
            href={href}
            className="no-print absolute left-4 top-4 text-xs text-slate-500 hover:text-brand-primary"
        >
            &larr; Kembali
        </a>
    );
}

export const PRINT_DYNAMIC = "force-dynamic" as const;
