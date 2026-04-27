"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";
import { addStringServiceToOrderItem } from "@/actions/niche";

interface Props {
    orderItemId: string;
    productTitle: string;
}

const STRING_BRANDS = ["Yonex BG65", "Yonex BG66", "Yonex BG80", "Li-Ning No.1", "Li-Ning No.7", "Ashaway ZyMax 65"];

export default function StringingAddOnButton({ orderItemId, productTitle }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [brand, setBrand] = useState<string>(STRING_BRANDS[0]);
    const [tension, setTension] = useState<string>("26");
    const [fee, setFee] = useState<string>("60000");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleSubmit() {
        setError(null);
        setSuccess(null);
        const tensionNum = Number(tension);
        const feeNum = Number(fee);
        if (Number.isNaN(tensionNum) || tensionNum < 15 || tensionNum > 40) {
            setError("Tension harus antara 15 dan 40 lbs.");
            return;
        }
        if (Number.isNaN(feeNum) || feeNum < 0) {
            setError("Biaya jasa harus angka ≥ 0.");
            return;
        }
        startTransition(async () => {
            try {
                await addStringServiceToOrderItem({
                    orderItemId,
                    stringBrand: brand,
                    tensionLbs: tensionNum,
                    serviceFee: feeNum,
                });
                setSuccess("Permintaan stringing terkirim ke penjual.");
                setOpen(false);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menambah jasa stringing.");
            }
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-primary"
            >
                <Wrench className="w-3 h-3" /> Tambah Pasang Senar
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pasang Senar untuk {productTitle}</h3>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Merk Senar</label>
                            <select value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20">
                                {STRING_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Tension (lbs)</label>
                            <input type="number" value={tension} onChange={(e) => setTension(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Biaya Jasa (Rp)</label>
                            <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20" />
                        </div>
                        {error && <p className="text-xs text-rose-600">{error}</p>}
                        {success && <p className="text-xs text-emerald-600">{success}</p>}
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">Batal</button>
                            <button type="button" onClick={handleSubmit} disabled={isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60">
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Konfirmasi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
