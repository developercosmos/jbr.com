"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X } from "lucide-react";
import { approveSellerPayout, rejectSellerPayout } from "@/actions/payouts";

type Row = {
    id: string;
    amount: string;
    status: string;
    bank_code: string;
    bank_account_number: string;
    bank_account_name: string;
    xendit_disbursement_id: string | null;
    failure_reason: string | null;
    created_at: string;
    sellerName: string | null;
    sellerEmail: string | null;
};

const STATUS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-700",
    PROCESSING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
    REJECTED: "bg-slate-100 text-slate-600",
};

function rupiah(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function PayoutsClient({ payouts }: { payouts: Row[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [busyId, setBusyId] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    function act(id: string, fn: () => Promise<{ success: boolean; error?: string }>) {
        setErr(null);
        setBusyId(id);
        startTransition(async () => {
            const r = await fn();
            setBusyId(null);
            if (!r.success) setErr(r.error ?? "Gagal.");
            router.refresh();
        });
    }

    if (payouts.length === 0) {
        return <p className="text-slate-500 text-sm">Belum ada permintaan penarikan.</p>;
    }

    return (
        <div className="space-y-3">
            {err && <div className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{err}</div>}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                        <tr>
                            <th className="text-left px-4 py-3">Seller</th>
                            <th className="text-left px-4 py-3">Rekening</th>
                            <th className="text-right px-4 py-3">Jumlah</th>
                            <th className="text-center px-4 py-3">Status</th>
                            <th className="text-left px-4 py-3">Tanggal</th>
                            <th className="text-center px-4 py-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {payouts.map((p) => (
                            <tr key={p.id}>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">{p.sellerName ?? "—"}</div>
                                    <div className="text-xs text-slate-400">{p.sellerEmail}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="text-slate-700">{p.bank_code} · {p.bank_account_number}</div>
                                    <div className="text-xs text-slate-400">a.n. {p.bank_account_name}</div>
                                    {p.failure_reason && <div className="text-xs text-red-500 mt-0.5">{p.failure_reason}</div>}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{rupiah(Number(p.amount))}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS[p.status] ?? "bg-slate-100 text-slate-600"}`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(p.created_at).toLocaleString("id-ID")}</td>
                                <td className="px-4 py-3">
                                    {p.status === "PENDING" ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => act(p.id, () => approveSellerPayout({ payoutId: p.id }))}
                                                disabled={isPending}
                                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                                            >
                                                {busyId === p.id && isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                                            </button>
                                            <button
                                                onClick={() => act(p.id, () => rejectSellerPayout({ payoutId: p.id }))}
                                                disabled={isPending}
                                                className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold disabled:opacity-50 flex items-center gap-1"
                                            >
                                                <X className="w-3 h-3" /> Tolak
                                            </button>
                                        </div>
                                    ) : (
                                        <span className="block text-center text-xs text-slate-400">
                                            {p.xendit_disbursement_id ? `Xendit: ${p.xendit_disbursement_id.slice(0, 10)}…` : "—"}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
