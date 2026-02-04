"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { createPaymentInvoice } from "@/actions/payments";

interface PaymentButtonProps {
    orderId: string;
    existingInvoiceUrl?: string | null;
}

export function PaymentButton({ orderId, existingInvoiceUrl }: PaymentButtonProps) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handlePayment = () => {
        setError(null);

        // If there's an existing invoice URL, just redirect
        if (existingInvoiceUrl) {
            window.location.href = existingInvoiceUrl;
            return;
        }

        startTransition(async () => {
            try {
                const result = await createPaymentInvoice(orderId);
                if (result.success && result.invoiceUrl) {
                    // Redirect to Xendit payment page
                    window.location.href = result.invoiceUrl;
                }
            } catch (err) {
                console.error("Payment error:", err);
                setError(err instanceof Error ? err.message : "Terjadi kesalahan saat membuat invoice pembayaran");
            }
        });
    };

    return (
        <div className="space-y-3">
            <button
                onClick={handlePayment}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold rounded-xl transition-all shadow-lg shadow-brand-primary/25 disabled:shadow-none"
            >
                {isPending ? (
                    <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Memproses...
                    </>
                ) : (
                    <>
                        <CreditCard className="w-5 h-5" />
                        Bayar Sekarang
                    </>
                )}
            </button>
            {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
}
