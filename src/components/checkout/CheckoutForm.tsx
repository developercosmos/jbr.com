"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CreditCard } from "lucide-react";
import { createOrderFromCart } from "@/actions/orders";
import { createPaymentInvoice } from "@/actions/payments";

type PaymentMethod = "BANK_TRANSFER" | "EWALLET" | "COD";

interface CheckoutFormProps {
    selectedAddressId: string | null;
    paymentMethod: PaymentMethod;
    shippingCourier: "jne" | "pos" | "tiki";
    canCheckout: boolean;
}

export function CheckoutForm({ selectedAddressId, paymentMethod, shippingCourier, canCheckout }: CheckoutFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [voucherCode, setVoucherCode] = useState("");
    const [step, setStep] = useState<"creating" | "redirecting">("creating");

    const handleCheckout = () => {
        setError("");

        if (!selectedAddressId) {
            setError("Pilih alamat pengiriman terlebih dahulu.");
            return;
        }

        if (!paymentMethod) {
            setError("Pilih metode pembayaran terlebih dahulu.");
            return;
        }

        setStep("creating");
        startTransition(async () => {
            try {

                // Step 1: Create order
                const orderResult = await createOrderFromCart({
                    shipping_address_id: selectedAddressId,
                    shipping_courier: shippingCourier,
                    voucher_code: voucherCode.trim() || undefined,
                });

                if (!orderResult.success || !orderResult.orders?.length) {
                    setError("Gagal membuat pesanan. Silakan coba lagi.");
                    return;
                }

                // Get the first order (for single seller checkout)
                const order = orderResult.orders[0];

                setStep("redirecting");

                // Step 2: Create Xendit payment invoice
                const paymentResult = await createPaymentInvoice(order.id, paymentMethod);

                // COD: no online invoice — go straight to the order page.
                if (paymentResult.success && "redirectUrl" in paymentResult && paymentResult.redirectUrl) {
                    window.location.href = paymentResult.redirectUrl;
                    return;
                }

                if (!paymentResult.success || !paymentResult.invoiceUrl) {
                    setError(paymentResult.error || "Gagal membuat invoice pembayaran. Silakan coba lagi.");
                    return;
                }

                // Redirect to Xendit payment page
                window.location.href = paymentResult.invoiceUrl;
            } catch (err) {
                console.error("Checkout error:", err);
                const msg = err instanceof Error && err.message ? err.message : "Terjadi kesalahan. Silakan coba lagi.";
                setError(msg);
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
            <div className="flex flex-col gap-1">
                <label htmlFor="voucher-code" className="text-xs font-medium text-slate-500">
                    Kode Voucher (opsional)
                </label>
                <input
                    id="voucher-code"
                    type="text"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                    placeholder="Masukkan kode voucher"
                    autoCapitalize="characters"
                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm uppercase"
                />
                <p className="text-[11px] text-slate-400">Berlaku untuk checkout dari satu penjual.</p>
            </div>
            <button
                onClick={handleCheckout}
                disabled={isPending || !canCheckout}
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
