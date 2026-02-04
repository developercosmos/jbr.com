import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, CreditCard, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { getOrderById } from "@/actions/orders";
import { getPaymentStatus } from "@/actions/payments";
import { notFound, redirect } from "next/navigation";
import { PaymentButton } from "./PaymentButton";

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PaymentPage({ params }: PageProps) {
    const { id } = await params;

    let order;
    try {
        order = await getOrderById(id);
    } catch {
        notFound();
    }

    if (!order) {
        notFound();
    }

    // If order is already paid, redirect to order detail
    if (order.status !== "PENDING_PAYMENT") {
        redirect(`/profile/orders/${id}`);
    }

    // Check for existing payment
    let paymentStatus;
    try {
        paymentStatus = await getPaymentStatus(id);
    } catch {
        paymentStatus = null;
    }

    return (
        <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 lg:px-16 py-8">
            {/* Back Link */}
            <Link
                href={`/profile/orders/${id}`}
                className="inline-flex items-center gap-2 text-brand-primary hover:underline mb-6"
            >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Detail Pesanan
            </Link>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-1">
                        Pembayaran
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-mono">
                        {order.order_number}
                    </p>
                </div>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50 uppercase tracking-wide">
                    <Clock className="w-4 h-4" />
                    Menunggu Pembayaran
                </span>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {/* Left Column - Order Items */}
                <div className="md:col-span-2 space-y-6">
                    {/* Items */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Package className="w-5 h-5 text-brand-primary" />
                                Item Pesanan ({order.items.length})
                            </h2>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {order.items.map((item) => (
                                <div key={item.id} className="p-4 flex gap-4">
                                    <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                                        {item.product?.images && item.product.images.length > 0 ? (
                                            <Image
                                                src={item.product.images[0]}
                                                alt={item.product.title}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-8 h-8 text-slate-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-slate-900 dark:text-white">
                                            {item.product?.title || "Produk"}
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {item.quantity} x {formatPrice(item.price)}
                                        </p>
                                        <p className="text-brand-primary font-bold mt-2">
                                            {formatPrice((parseFloat(item.price) * item.quantity).toString())}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4">
                        <div className="flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-1">Informasi Pembayaran</h3>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Setelah klik &quot;Bayar Sekarang&quot;, Anda akan diarahkan ke halaman pembayaran Xendit
                                    untuk memilih metode pembayaran (Transfer Bank, E-Wallet, QRIS, dll).
                                    Pembayaran harus diselesaikan dalam waktu 24 jam.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column - Payment Summary */}
                <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-brand-primary" />
                                Ringkasan Pembayaran
                            </h2>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="text-slate-900 dark:text-white">
                                    {formatPrice(order.subtotal)}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Ongkos Kirim</span>
                                <span className="text-slate-900 dark:text-white">
                                    {order.shipping_cost ? formatPrice(order.shipping_cost) : "Gratis"}
                                </span>
                            </div>
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between">
                                <span className="font-bold text-slate-900 dark:text-white">Total Bayar</span>
                                <span className="font-bold text-brand-primary text-xl">
                                    {formatPrice(order.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Button */}
                    <PaymentButton
                        orderId={order.id}
                        existingInvoiceUrl={paymentStatus?.payment?.xendit_invoice_url}
                    />

                    {/* Secure Payment Badge */}
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Pembayaran aman dengan Xendit</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
