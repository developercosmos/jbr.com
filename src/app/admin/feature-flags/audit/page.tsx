import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { getFeatureFlagAuditLog } from "@/actions/admin/feature-flags";

export const dynamic = "force-dynamic";

function formatDate(value: string | Date) {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function FeatureFlagsAuditPage() {
    const rows = await getFeatureFlagAuditLog({ limit: 150 });

    return (
        <div className="flex-1 p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <Link href="/admin/feature-flags" className="inline-flex items-center gap-2 text-brand-primary hover:underline mb-3">
                            <ArrowLeft className="w-4 h-4" />
                            Kembali ke Feature Flags
                        </Link>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase flex items-center gap-3">
                            <History className="w-7 h-7 text-brand-primary" />
                            Audit Log Feature Flags
                        </h1>
                        <p className="text-slate-500 mt-1">Riwayat perubahan toggle, rollout, dan kill-switch.</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <div className="divide-y divide-slate-200">
                        {rows.map((row) => (
                            <div key={row.id} className="p-5 space-y-3">
                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                    <div>
                                        <div className="font-semibold text-slate-900">{row.flag_key}</div>
                                        <div className="text-xs text-slate-500">
                                            Oleh {row.changed_by} · {formatDate(row.created_at)}
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 w-fit">
                                        {row.reason || "Tanpa alasan"}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-xs">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-x-auto">
                                        <div className="font-semibold text-slate-700 mb-2">Before</div>
                                        <pre className="whitespace-pre-wrap break-all text-slate-600">{JSON.stringify(row.before_state, null, 2)}</pre>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 overflow-x-auto">
                                        <div className="font-semibold text-slate-700 mb-2">After</div>
                                        <pre className="whitespace-pre-wrap break-all text-slate-600">{JSON.stringify(row.after_state, null, 2)}</pre>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {rows.length === 0 && (
                            <div className="p-10 text-center text-slate-500">Belum ada audit log feature flag.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}