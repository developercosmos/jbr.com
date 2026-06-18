"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { cancelMyOrder } from "@/actions/payments";

export function CancelOrderButton({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleCancel = () => {
        if (!confirm("Yakin batalkan pesanan ini? Stok dikembalikan dan tindakan tidak dapat diurungkan.")) return;
        setError(null);
        startTransition(async () => {
            try {
                const res = await cancelMyOrder(orderId);
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal membatalkan pesanan.");
                    return;
                }
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : "Gagal membatalkan pesanan.");
            }
        });
    };

    return (
        <div className="mt-2">
            <button
                type="button"
                onClick={handleCancel}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 font-bold rounded-xl transition-colors disabled:opacity-50"
            >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><XCircle className="w-5 h-5" />Batalkan Pesanan</>}
            </button>
            {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 text-center">{error}</p>}
        </div>
    );
}
