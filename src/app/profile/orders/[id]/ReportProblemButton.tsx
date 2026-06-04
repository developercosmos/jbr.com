"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { createOrderDispute } from "@/actions/disputes";

interface ExistingDispute {
    dispute_number: string;
    status: string;
    type: string;
}

interface Props {
    orderId: string;
    existing: ExistingDispute | null;
}

const DISPUTE_TYPES: { value: string; label: string }[] = [
    { value: "ITEM_NOT_RECEIVED", label: "Barang tidak diterima" },
    { value: "ITEM_NOT_AS_DESCRIBED", label: "Barang tidak sesuai deskripsi" },
    { value: "REFUND_REQUEST", label: "Minta pengembalian dana" },
    { value: "SELLER_NOT_RESPONSIVE", label: "Penjual tidak merespons" },
    { value: "OTHER", label: "Lainnya" },
];

export default function ReportProblemButton({ orderId, existing }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("ITEM_NOT_RECEIVED");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    if (existing) {
        return (
            <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    Sengketa sedang diproses
                </div>
                <p className="mt-1 text-xs">
                    No. {existing.dispute_number} · status {existing.status}. Tim kami akan menindaklanjuti.
                </p>
            </div>
        );
    }

    function handleSubmit() {
        setError(null);
        startTransition(async () => {
            try {
                await createOrderDispute({ orderId, type: type as never, description });
                setOpen(false);
                setDescription("");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membuka sengketa.");
            }
        });
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            >
                <AlertTriangle className="w-4 h-4" />
                Laporkan Masalah
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md p-5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Laporkan Masalah Pesanan</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Dana Anda tetap ditahan di escrow selama sengketa berlangsung.
                        </p>

                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jenis masalah</label>
                        <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full mb-3 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm"
                        >
                            {DISPUTE_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>

                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Jelaskan masalahnya</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            placeholder="Ceritakan apa yang terjadi (min. 10 karakter)…"
                            className="w-full mb-3 px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm resize-none"
                        />

                        {error && <div className="mb-3 text-xs text-rose-600 dark:text-rose-300">{error}</div>}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl text-sm"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending || description.trim().length < 10}
                                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Kirim Laporan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
