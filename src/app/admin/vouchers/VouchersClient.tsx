"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Ban } from "lucide-react";
import { createVoucher, revokeVoucher } from "@/actions/vouchers";

type VoucherType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

interface Voucher {
    id: string;
    code: string;
    type: VoucherType;
    value: number;
    max_uses: number | null;
    max_uses_per_user: number;
    valid_from: string;
    valid_to: string | null;
    min_order_amount: number | null;
    is_active: boolean;
}

interface Props {
    initialVouchers: Voucher[];
}

export default function VouchersClient({ initialVouchers }: Props) {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [type, setType] = useState<VoucherType>("PERCENT");
    const [value, setValue] = useState<string>("10");
    const [maxUses, setMaxUses] = useState<string>("");
    const [maxUsesPerUser, setMaxUsesPerUser] = useState<string>("1");
    const [minOrder, setMinOrder] = useState<string>("");
    const [validTo, setValidTo] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleCreate() {
        setError(null);
        setSuccess(null);
        const numericValue = Number(value);
        if (Number.isNaN(numericValue) || numericValue < 0) {
            setError("Value harus angka ≥ 0.");
            return;
        }
        startTransition(async () => {
            try {
                await createVoucher({
                    code: code.trim().toUpperCase(),
                    type,
                    value: numericValue,
                    max_uses: maxUses ? Number(maxUses) : undefined,
                    max_uses_per_user: maxUsesPerUser ? Number(maxUsesPerUser) : 1,
                    min_order_amount: minOrder ? Number(minOrder) : undefined,
                    valid_to: validTo ? new Date(validTo).toISOString() : undefined,
                    is_active: true,
                });
                setSuccess(`Voucher ${code.toUpperCase()} dibuat.`);
                setCode("");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membuat voucher.");
            }
        });
    }

    function handleRevoke(voucherId: string) {
        if (!confirm("Cabut voucher ini? Penggunaan baru tidak akan diizinkan.")) return;
        startTransition(async () => {
            try {
                await revokeVoucher(voucherId);
                router.refresh();
            } catch (err) {
                console.error(err);
            }
        });
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-brand-primary" />
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Buat Voucher</h2>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Kode</label>
                        <input
                            type="text"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            placeholder="HEMAT10"
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 uppercase"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Tipe</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value as VoucherType)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        >
                            <option value="PERCENT">PERCENT</option>
                            <option value="FIXED">FIXED</option>
                            <option value="FREE_SHIPPING">FREE_SHIPPING</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                            Value {type === "PERCENT" ? "(%)" : type === "FIXED" ? "(Rp)" : "(diabaikan)"}
                        </label>
                        <input
                            type="number"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            disabled={type === "FREE_SHIPPING"}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Min Belanja (Rp, opsional)</label>
                        <input
                            type="number"
                            value={minOrder}
                            onChange={(e) => setMinOrder(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Max Uses Total (opsional)</label>
                        <input
                            type="number"
                            value={maxUses}
                            onChange={(e) => setMaxUses(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Max Per User</label>
                        <input
                            type="number"
                            value={maxUsesPerUser}
                            onChange={(e) => setMaxUsesPerUser(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 mb-1">Berlaku Hingga (opsional)</label>
                        <input
                            type="datetime-local"
                            value={validTo}
                            onChange={(e) => setValidTo(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                        />
                    </div>
                    {error && <p className="md:col-span-2 text-xs text-rose-600">{error}</p>}
                    {success && <p className="md:col-span-2 text-xs text-emerald-600">{success}</p>}
                    <div className="md:col-span-2">
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={isPending || !code.trim()}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Simpan Voucher
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Voucher Terdaftar</h2>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {initialVouchers.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Belum ada voucher.</div>
                    ) : (
                        initialVouchers.map((v) => (
                            <div key={v.id} className="p-5 flex items-start justify-between gap-4">
                                <div className="space-y-1 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <strong className="font-mono text-slate-900 dark:text-white">{v.code}</strong>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                            {v.type}
                                        </span>
                                        {!v.is_active && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                                dicabut
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Value: {v.type === "PERCENT" ? `${v.value}%` : v.type === "FIXED" ? `Rp ${v.value.toLocaleString("id-ID")}` : "free shipping"}
                                        {" · "}Min Belanja: {v.min_order_amount ? `Rp ${v.min_order_amount.toLocaleString("id-ID")}` : "tidak ada"}
                                        {" · "}Max Total: {v.max_uses ?? "∞"}
                                        {" · "}Per User: {v.max_uses_per_user}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Berlaku: {new Date(v.valid_from).toLocaleDateString("id-ID")} →{" "}
                                        {v.valid_to ? new Date(v.valid_to).toLocaleDateString("id-ID") : "tanpa batas"}
                                    </div>
                                </div>
                                {v.is_active && (
                                    <button
                                        type="button"
                                        onClick={() => handleRevoke(v.id)}
                                        className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
                                    >
                                        <Ban className="w-3 h-3" /> Cabut
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
