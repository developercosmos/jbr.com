import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { requireAdminFinanceReader } from "@/lib/admin-finance";
import { verifyGlIntegrity } from "@/actions/accounting/verify";

export const dynamic = "force-dynamic";

export default async function AdminFinanceVerifyPage(props: {
    searchParams: Promise<{ recon?: string }>;
}) {
    await requireAdminFinanceReader();
    const sp = await props.searchParams;
    const includeRecon = sp.recon !== "0";
    const report = await verifyGlIntegrity({ includeReconciliation: includeRecon });

    return (
        <div className="flex-1 p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <Link href="/admin/finance" className="text-sm text-slate-500 hover:text-brand-primary">
                        &larr; Finance
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold uppercase tracking-tight text-slate-900">
                        GL Integrity Check
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Verifikasi integritas journal, balance, dan rekonsiliasi terhadap legacy ledger.
                        Dijalankan {new Date(report.ranAt).toLocaleString("id-ID")} dalam {report.durationMs} ms.
                    </p>
                </div>

                <div
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                        report.passed
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-800"
                    }`}
                >
                    {report.passed ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <strong>{report.passed ? "ALL CHECKS PASSED" : "ATTENTION REQUIRED"}</strong>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-left">Check</th>
                                <th className="px-4 py-3 text-left">Status</th>
                                <th className="px-4 py-3 text-left">Detail</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {report.checks.map((c) => (
                                <tr key={c.name}>
                                    <td className="px-4 py-2 font-mono text-xs">{c.name}</td>
                                    <td className="px-4 py-2">
                                        {c.passed ? (
                                            <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">PASS</span>
                                        ) : (
                                            <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">FAIL</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 text-slate-700">
                                        {c.detail}
                                        {c.sample && Array.isArray(c.sample) && c.sample.length > 0 && (
                                            <details className="mt-2">
                                                <summary className="cursor-pointer text-xs text-slate-500">Sample ({c.sample.length})</summary>
                                                <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-[10px] text-slate-700">{JSON.stringify(c.sample, null, 2)}</pre>
                                            </details>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {report.reconciliation && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <div className="border-b border-slate-200 px-4 py-3">
                            <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">Reconciliation Legacy ↔ GL</h2>
                        </div>
                        <pre className="overflow-x-auto p-4 text-[11px] text-slate-700">{JSON.stringify(report.reconciliation, null, 2)}</pre>
                    </div>
                )}

                <div className="flex gap-3 text-sm">
                    <Link href="?" className="rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white hover:opacity-90">
                        Re-run (with reconciliation)
                    </Link>
                    <Link href="?recon=0" className="rounded-lg bg-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-300">
                        Re-run (skip recon)
                    </Link>
                </div>
            </div>
        </div>
    );
}
