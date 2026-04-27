"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { confirmReceipt } from "@/actions/escrow";

interface Props {
    orderId: string;
    releaseDueAt: string | null;
}

function formatRemaining(due: Date): string {
    const ms = due.getTime() - Date.now();
    if (ms <= 0) return "akan segera diselesaikan";
    const hours = Math.floor(ms / (60 * 60 * 1000));
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const restHours = hours % 24;
        return `${days} hari ${restHours} jam lagi`;
    }
    if (hours > 0) {
        return `${hours} jam lagi`;
    }
    const minutes = Math.max(1, Math.floor(ms / (60 * 1000)));
    return `${minutes} menit lagi`;
}

export default function ConfirmReceiptButton({ orderId, releaseDueAt }: Props) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const dueDate = releaseDueAt ? new Date(releaseDueAt) : null;

    function handleConfirm() {
        setError(null);
        startTransition(async () => {
            try {
                await confirmReceipt(orderId);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengonfirmasi penerimaan.");
            }
        });
    }

    return (
        <div className="mt-4 space-y-2">
            {dueDate && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    Dana akan otomatis dirilis ke seller {formatRemaining(dueDate)}.
                </div>
            )}
            <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-60"
            >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                Konfirmasi Diterima
            </button>
            {error && (
                <div className="text-xs text-rose-600 dark:text-rose-300">{error}</div>
            )}
        </div>
    );
}
