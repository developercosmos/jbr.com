import { notFound } from "next/navigation";
import Link from "next/link";
import { getPaymentStatus, checkInvoiceStatus } from "@/actions/payments";
import { CheckCircle, XCircle, Clock, ExternalLink, ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { PaymentStatusPoller } from "./PaymentStatusPoller";

interface PaymentPageProps {
    params: Promise<{ orderId: string }>;
    searchParams: Promise<{ status?: string }>;
}

export default async function PaymentStatusPage({ params, searchParams }: PaymentPageProps) {
    const { orderId } = await params;
    const { status: queryStatus } = await searchParams;

    let paymentData;
    try {
        paymentData = await getPaymentStatus(orderId);
    } catch {
        notFound();
    }

    const { order, payment } = paymentData;

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getStatusDisplay = () => {
        if (order.status === "PAID" || payment?.status === "PAID") {
            return {
                icon: <CheckCircle className="w-16 h-16 text-green-500" />,
                title: "Pembayaran Berhasil!",
                description: "Terima kasih. Pesanan Anda sedang diproses oleh penjual.",
                bgColor: "bg-green-50",
                borderColor: "border-green-200",
            };
        }
        if (payment?.status === "EXPIRED") {
            return {
                icon: <XCircle className="w-16 h-16 text-red-500" />,
                title: "Pembayaran Kedaluwarsa",
                description: "Batas waktu pembayaran telah berakhir. Silakan buat pesanan baru.",
                bgColor: "bg-red-50",
                borderColor: "border-red-200",
            };
        }
        if (payment?.status === "FAILED") {
            return {
                icon: <XCircle className="w-16 h-16 text-red-500" />,
                title: "Pembayaran Gagal",
                description: "Terjadi kesalahan pada pembayaran. Silakan coba lagi.",
                bgColor: "bg-red-50",
                borderColor: "border-red-200",
            };
        }
        // Pending
        return {
            icon: <Clock className="w-16 h-16 text-amber-500" />,
            title: "Menunggu Pembayaran",
            description: "Silakan selesaikan pembayaran Anda sebelum batas waktu berakhir.",
            bgColor: "bg-amber-50",
            borderColor: "border-amber-200",
        };
    };

    const statusDisplay = getStatusDisplay();
    const isPending = payment?.status === "PENDING" && order.status === "PENDING_PAYMENT";

    return (
        <main className="min-h-screen bg-slate-50 py-8">
            <div className="max-w-2xl mx-auto px-4">
                {/* Back Button */}
                <Link
                    href="/profile/orders"
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-primary mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="font-medium">Kembali ke Pesanan</span>
                </Link>

                {/* Status Card */}
                <div className={`rounded-2xl ${statusDisplay.bgColor} ${statusDisplay.borderColor} border p-8 text-center mb-6`}>
                    <div className="flex justify-center mb-4">
                        {statusDisplay.icon}
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        {statusDisplay.title}
                    </h1>
                    <p className="text-slate-600">
                        {statusDisplay.description}
                    </p>
                </div>

                {/* Order Details Card */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900">Detail Pesanan</h2>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Nomor Pesanan</span>
                            <span className="font-bold text-slate-900">{order.order_number}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Total Pembayaran</span>
                            <span className="font-bold text-brand-primary text-lg">{formatPrice(order.total)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${order.status === "PAID"
                                    ? "bg-green-100 text-green-700"
                                    : order.status === "PENDING_PAYMENT"
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-700"
                                }`}>
                                {order.status === "PENDING_PAYMENT" ? "Menunggu Pembayaran" :
                                    order.status === "PAID" ? "Dibayar" :
                                        order.status === "PROCESSING" ? "Diproses" :
                                            order.status === "SHIPPED" ? "Dikirim" :
                                                order.status === "DELIVERED" ? "Terkirim" :
                                                    order.status === "COMPLETED" ? "Selesai" :
                                                        order.status}
                            </span>
                        </div>
                        {payment?.payment_method && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Metode Pembayaran</span>
                                <span className="text-slate-900">{payment.payment_method}</span>
                            </div>
                        )}
                        {payment?.paid_at && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Waktu Pembayaran</span>
                                <span className="text-slate-900">{formatDate(payment.paid_at)}</span>
                            </div>
                        )}
                        {payment?.expires_at && isPending && (
                            <div className="flex justify-between">
                                <span className="text-slate-500">Batas Pembayaran</span>
                                <span className="text-red-600 font-medium">{formatDate(payment.expires_at)}</span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-3">
                        {isPending && payment?.xendit_invoice_url && (
                            <a
                                href={payment.xendit_invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full h-12 rounded-lg bg-brand-primary hover:bg-blue-600 text-white font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Bayar Sekarang
                            </a>
                        )}
                        <Link
                            href="/profile/orders"
                            className="w-full h-12 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-900 font-medium flex items-center justify-center transition-colors"
                        >
                            Lihat Semua Pesanan
                        </Link>
                    </div>
                </div>

                {/* Auto-refresh for pending payments */}
                {isPending && payment?.id && (
                    <PaymentStatusPoller paymentId={payment.id} />
                )}
            </div>
        </main>
    );
}
