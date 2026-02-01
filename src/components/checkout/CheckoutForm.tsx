"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, CreditCard } from "lucide-react";
import { createOrderFromCart } from "@/actions/orders";
import { createPaymentInvoice } from "@/actions/payments";

export function CheckoutForm() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [step, setStep] = useState<"creating" | "redirecting">("creating");

    const handleCheckout = () => {
        setError("");
        startTransition(async () => {
            try {
                setStep("creating");

                // Step 1: Create order
                const orderResult = await createOrderFromCart({});

                if (!orderResult.success || !orderResult.orders?.length) {
                    setError("Gagal membuat pesanan. Silakan coba lagi.");
                    return;
                }

                // Get the first order (for single seller checkout)
                const order = orderResult.orders[0];

                setStep("redirecting");

                // Step 2: Create Xendit payment invoice
                const paymentResult = await createPaymentInvoice(order.id);

                if (!paymentResult.success || !paymentResult.invoiceUrl) {
                    // If payment creation fails, still redirect to orders page
                    router.push(`/profile/orders?success=true&pending_payment=true`);
                    router.refresh();
                    return;
                }

                // Redirect to Xendit payment page
                window.location.href = paymentResult.invoiceUrl;
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
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{step === "creating" ? "Membuat Pesanan..." : "Mengalihkan ke Pembayaran..."}</span>
                    </>
                ) : (
                    <>
                        <CreditCard className="w-4 h-4" />
                        Bayar Sekarang
                    </>
                )}
            </button>
            <p className="text-xs text-center text-slate-500">
                Anda akan diarahkan ke halaman pembayaran Xendit
            </p>
        </div>
    );
}
