"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Tag } from "lucide-react";
import { createOffer } from "@/actions/offers";

interface Props {
    listingId: string;
    listingPrice: number;
    autoDeclineBelow: number | null;
}

export default function MakeOfferButton({ listingId, listingPrice, autoDeclineBelow }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState<string>(
        autoDeclineBelow ? String(autoDeclineBelow) : String(Math.round(listingPrice * 0.9))
    );
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit() {
        setError(null);
        setSuccess(null);
        const numericAmount = Number(amount);
        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            setError("Nominal harus angka positif.");
            return;
        }
        if (numericAmount >= listingPrice) {
            setError("Nominal harus lebih rendah dari harga listing.");
            return;
        }
        startTransition(async () => {
            try {
                const result = await createOffer({
                    listingId,
                    amount: numericAmount,
                    notes: notes.trim() || undefined,
                });
                if (!result.success && result.error === "rate_limited") {
                    const retryMinutes = Math.max(1, Math.ceil((result.retryAfterSec ?? 0) / 60));
                    setError(`Terlalu sering menawar. Coba lagi dalam ${retryMinutes} menit.`);
                    return;
                }
                if (result.autoDeclined) {
                    setError("Penawaran otomatis ditolak karena di bawah ambang batas penjual.");
                } else {
                    setSuccess("Penawaran terkirim ke penjual.");
                    setOpen(false);
                    router.refresh();
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengirim penawaran.");
            }
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all"
            >
                <Tag className="w-5 h-5" /> Tawar
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Buat Penawaran</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Harga listing: Rp {listingPrice.toLocaleString("id-ID")}
                                {autoDeclineBelow ? ` · Penjual menerima minimal Rp ${autoDeclineBelow.toLocaleString("id-ID")}` : ""}
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nominal Penawaran (Rp)</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Catatan (opsional)</label>
                            <textarea
                                rows={3}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                maxLength={500}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm resize-none"
                            />
                        </div>
                        {error && <p className="text-xs text-rose-600">{error}</p>}
                        {success && <p className="text-xs text-emerald-600">{success}</p>}
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Kirim Tawaran
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
