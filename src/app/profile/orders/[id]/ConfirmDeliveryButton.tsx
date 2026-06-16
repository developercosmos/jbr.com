"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Loader2 } from "lucide-react";
import { confirmDelivery } from "@/actions/shipping";

interface Props {
    orderId: string;
}

// Shown while an order is SHIPPED. The buyer confirms the package arrived, which
// flips the order to DELIVERED and arms the escrow auto-release timer (after which
// funds release to the seller unless the buyer confirms receipt sooner or opens a
// dispute).
export default function ConfirmDeliveryButton({ orderId }: Props) {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function handleConfirm() {
        setError(null);
        startTransition(async () => {
            try {
                const res = await confirmDelivery(orderId);
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal konfirmasi pengiriman.");
                    return;
                }
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengonfirmasi penerimaan barang.");
            }
        });
    }

    return (
        <div className="mt-4 space-y-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
                Sudah menerima barang? Konfirmasi agar pesanan masuk masa garansi sebelum dana diteruskan ke penjual.
            </p>
            <button
                type="button"
                onClick={handleConfirm}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all disabled:opacity-60"
            >
                {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <PackageCheck className="w-5 h-5" />}
                Konfirmasi Barang Diterima
            </button>
            {error && (
                <div className="text-xs text-rose-600 dark:text-rose-300">{error}</div>
            )}
        </div>
    );
}
