"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { createOrderFromCart } from "@/actions/orders";

export function CheckoutForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const handleCheckout = () => {
        setError("");
        startTransition(async () => {
            try {
                const result = await createOrderFromCart({});

                if (result.success && result.orders) {
                    // Redirect to order confirmation
                    router.push(`/profile/orders?success=true`);
                    router.refresh();
                } else {
                    setError("Gagal membuat pesanan. Silakan coba lagi.");
                }
            } catch (err) {
                console.error("Checkout error:", err);
                setError("Terjadi kesalahan. Silakan coba lagi.");
            }
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                </div>
            )}
            <button
                onClick={handleCheckout}
                disabled={isPending}
                className="w-full h-12 rounded-lg bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold text-base shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
                {isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                        <Lock className="w-4 h-4" />
                        Bayar Sekarang
                    </>
                )}
            </button>
        </div>
    );
}
