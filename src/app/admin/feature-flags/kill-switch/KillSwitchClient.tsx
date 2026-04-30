"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Power, RefreshCw, ShieldAlert } from "lucide-react";
import { activateFeatureFlagKillSwitch, deactivateFeatureFlagKillSwitch } from "@/actions/admin/feature-flags";

export function KillSwitchClient({
    current,
}: {
    current: {
        active: boolean;
        scope: string;
        reason: string | null;
        activated_at: string | Date | null;
    } | null;
}) {
    const router = useRouter();
    const [scope, setScope] = useState<"all-new" | "pdp-only" | "differentiator-only">(
        (current?.scope as "all-new" | "pdp-only" | "differentiator-only") || "all-new"
    );
    const [reason, setReason] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleActivate() {
        if (confirmText !== "MATIKAN SEMUA") {
            setMessage({ type: "error", text: "Ketik MATIKAN SEMUA untuk konfirmasi." });
            return;
        }
        startTransition(async () => {
            try {
                await activateFeatureFlagKillSwitch({ scope, reason, confirmationPhrase: confirmText });
                setMessage({ type: "success", text: "Kill-switch berhasil diaktifkan." });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal mengaktifkan kill-switch." });
            }
        });
    }

    function handleDeactivate() {
        startTransition(async () => {
            try {
                await deactivateFeatureFlagKillSwitch(reason);
                setMessage({ type: "success", text: "Kill-switch berhasil dinonaktifkan." });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menonaktifkan kill-switch." });
            }
        });
    }

    return (
        <div className="space-y-6">
            <div className={`rounded-2xl border p-5 ${current?.active ? "border-rose-200 bg-rose-50" : "border-emerald-200 bg-emerald-50"}`}>
                <div className="flex items-center gap-3 font-semibold text-slate-900">
                    {current?.active ? <ShieldAlert className="w-5 h-5 text-rose-600" /> : <Power className="w-5 h-5 text-emerald-600" />}
                    Status saat ini: {current?.active ? "AKTIF" : "NONAKTIF"}
                </div>
                <p className="text-sm text-slate-600 mt-2">
                    Scope: {current?.scope || "all-new"} · Alasan: {current?.reason || "-"}
                </p>
            </div>

            {message && (
                <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                    {message.text}
                </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    Gunakan hanya saat incident. Ini mematikan flag yang masuk scope terpilih.
                </div>

                <label className="block text-sm space-y-1">
                    <span className="font-medium text-slate-700">Scope</span>
                    <select value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50">
                        <option value="all-new">all-new</option>
                        <option value="pdp-only">pdp-only</option>
                        <option value="differentiator-only">differentiator-only</option>
                    </select>
                </label>

                <label className="block text-sm space-y-1">
                    <span className="font-medium text-slate-700">Alasan</span>
                    <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 resize-none" />
                </label>

                <label className="block text-sm space-y-1">
                    <span className="font-medium text-slate-700">Konfirmasi aktivasi</span>
                    <input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="Ketik MATIKAN SEMUA" className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50" />
                </label>

                <div className="flex flex-wrap gap-3">
                    <button type="button" disabled={isPending} onClick={handleActivate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors">
                        {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                        Aktifkan Kill-Switch
                    </button>
                    <button type="button" disabled={isPending} onClick={handleDeactivate} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-brand-primary hover:text-brand-primary transition-colors">
                        {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                        Nonaktifkan Kill-Switch
                    </button>
                </div>
            </div>
        </div>
    );
}