"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Building2, Loader2, Check } from "lucide-react";
import { updateSellerPayoutBank, requestSellerPayout } from "@/actions/payouts";

type Payout = {
    id: string;
    amount: string;
    status: string;
    bank_code: string;
    bank_account_number: string;
    failure_reason: string | null;
    created_at: Date | string;
};

type Props = {
    available: number;
    minPayout: number;
    bank: { name: string | null; accountNumber: string | null; accountName: string | null; resolvable: boolean } | null;
    payouts: Payout[];
};

const STATUS: Record<string, { label: string; cls: string }> = {
    PENDING: { label: "Menunggu Approval", cls: "bg-amber-100 text-amber-700" },
    PROCESSING: { label: "Diproses", cls: "bg-blue-100 text-blue-700" },
    COMPLETED: { label: "Selesai", cls: "bg-green-100 text-green-700" },
    FAILED: { label: "Gagal", cls: "bg-red-100 text-red-700" },
    REJECTED: { label: "Ditolak", cls: "bg-slate-100 text-slate-600" },
};

function rupiah(n: number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export function SellerPayoutPanel({ available, minPayout, bank, payouts }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [editBank, setEditBank] = useState(!bank?.accountNumber);
    const [bankName, setBankName] = useState(bank?.name ?? "");
    const [accountNumber, setAccountNumber] = useState(bank?.accountNumber ?? "");
    const [accountName, setAccountName] = useState(bank?.accountName ?? "");
    const [amount, setAmount] = useState("");
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const bankReady = !!bank?.accountNumber && bank.resolvable;

    function saveBank() {
        setMsg(null);
        startTransition(async () => {
            const r = await updateSellerPayoutBank({ bankName, accountNumber, accountName });
            if (r.success) {
                setMsg({ type: "ok", text: "Rekening tersimpan." });
                setEditBank(false);
                router.refresh();
            } else setMsg({ type: "err", text: r.error ?? "Gagal." });
        });
    }

    function withdraw() {
        setMsg(null);
        const amt = Math.floor(Number(amount.replace(/[^0-9]/g, "")) || 0);
        if (amt < minPayout) {
            setMsg({ type: "err", text: `Minimal penarikan ${rupiah(minPayout)}.` });
            return;
        }
        startTransition(async () => {
            const r = await requestSellerPayout({ amount: amt });
            if (r.success) {
                setMsg({ type: "ok", text: "Penarikan diajukan — menunggu persetujuan admin." });
                setAmount("");
                router.refresh();
            } else setMsg({ type: "err", text: r.error ?? "Gagal." });
        });
    }

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-brand-primary" /> Penarikan Saldo
                </h2>
                <div className="text-right">
                    <p className="text-xs text-slate-500">Saldo tersedia</p>
                    <p className="text-xl font-black text-brand-primary">{rupiah(available)}</p>
                </div>
            </div>

            {msg && (
                <div className={`text-sm rounded-lg px-3 py-2 ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {msg.text}
                </div>
            )}

            {/* Bank account */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-slate-400" /> Rekening Tujuan
                    </span>
                    {!editBank && (
                        <button onClick={() => setEditBank(true)} className="text-xs font-medium text-brand-primary hover:underline">
                            Ubah
                        </button>
                    )}
                </div>
                {editBank ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank (mis. BCA)"
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm" />
                        <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="No. Rekening"
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm" />
                        <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Atas Nama"
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm" />
                        <button onClick={saveBank} disabled={isPending}
                            className="sm:col-span-3 px-4 py-2 rounded-lg bg-brand-primary text-white text-sm font-bold disabled:bg-slate-400 flex items-center justify-center gap-2">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Simpan Rekening
                        </button>
                    </div>
                ) : bank?.accountNumber ? (
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                        <span className="font-semibold">{bank.name}</span> · {bank.accountNumber} · a.n. {bank.accountName}
                        {!bank.resolvable && <span className="block text-xs text-amber-600 mt-1">Nama bank tidak dikenali sistem — penarikan akan ditolak. Perbaiki nama bank.</span>}
                    </p>
                ) : (
                    <p className="text-sm text-slate-500">Belum ada rekening. Tambahkan untuk menarik saldo.</p>
                )}
            </div>

            {/* Withdraw */}
            <div className="flex flex-col sm:flex-row gap-2">
                <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    inputMode="numeric"
                    placeholder={`Jumlah (min ${rupiah(minPayout)})`}
                    disabled={!bankReady || available < minPayout}
                    className="flex-1 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-sm disabled:opacity-50"
                />
                <button
                    onClick={withdraw}
                    disabled={isPending || !bankReady || available < minPayout}
                    className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:bg-slate-400 flex items-center justify-center gap-2"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />} Tarik Saldo
                </button>
            </div>
            {!bankReady && <p className="text-xs text-slate-400">Lengkapi rekening yang dikenali sistem untuk menarik saldo.</p>}

            {/* History */}
            {payouts.length > 0 && (
                <div className="pt-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Riwayat Penarikan</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {payouts.map((p) => {
                            const s = STATUS[p.status] ?? { label: p.status, cls: "bg-slate-100 text-slate-600" };
                            return (
                                <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                                    <div>
                                        <span className="font-semibold text-slate-900 dark:text-white">{rupiah(Number(p.amount))}</span>
                                        <span className="text-xs text-slate-400 ml-2">{new Date(p.created_at).toLocaleDateString("id-ID")}</span>
                                        {p.status === "FAILED" && p.failure_reason && (
                                            <span className="block text-xs text-red-500">{p.failure_reason}</span>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
