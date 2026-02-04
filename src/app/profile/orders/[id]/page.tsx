import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, Truck, CheckCircle, Clock, XCircle, CreditCard, MapPin, Store, Phone, Mail } from "lucide-react";
import { getOrderById } from "@/actions/orders";
import { notFound } from "next/navigation";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
    PENDING_PAYMENT: {
        label: "Menunggu Pembayaran",
        icon: <CreditCard className="w-4 h-4" />,
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-300",
        border: "border-yellow-200 dark:border-yellow-700/50"
    },
    PAID: {
        label: "Dibayar",
        icon: <CheckCircle className="w-4 h-4" />,
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-800 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-700/50"
    },
    PROCESSING: {
        label: "Diproses",
        icon: <Package className="w-4 h-4" />,
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700/50"
    },
    SHIPPED: {
        label: "Sedang Dikirim",
        icon: <Truck className="w-4 h-4" />,
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700/50"
    },
    DELIVERED: {
        label: "Sampai Tujuan",
        icon: <CheckCircle className="w-4 h-4" />,
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        border: "border-green-200 dark:border-green-700/50"
    },
    COMPLETED: {
        label: "Selesai",
        icon: <CheckCircle className="w-4 h-4" />,
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        border: "border-green-200 dark:border-green-700/50"
    },
    CANCELLED: {
        label: "Dibatalkan",
        icon: <XCircle className="w-4 h-4" />,
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        border: "border-red-200 dark:border-red-700/50"
    },
    REFUNDED: {
        label: "Dikembalikan",
        icon: <Clock className="w-4 h-4" />,
        bg: "bg-slate-100 dark:bg-slate-800/50",
        text: "text-slate-800 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-700/50"
    },
};

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
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

    const status = statusConfig[order.status] || statusConfig.PENDING_PAYMENT;

    return (
        <div className="flex-1">
            {/* Header */}
            <div className="mb-6">
                <Link
                    href="/profile/orders"
                    className="inline-flex items-center gap-2 text-brand-primary hover:underline mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Kembali ke Pesanan
                </Link>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-1">
                            Detail Pesanan
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-mono">
                            {order.order_number}
                        </p>
                    </div>
                    <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${status.bg} ${status.text} border ${status.border} uppercase tracking-wide`}>
                        {status.icon}
                        {status.label}
                    </span>
                </div>
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
                                        <Link
                                            href={item.product?.slug ? `/product/${item.product.slug}` : "#"}
                                            className="font-bold text-slate-900 dark:text-white hover:text-brand-primary transition-colors"
                                        >
                                            {item.product?.title || "Produk"}
                                        </Link>
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

                    {/* Shipping Address */}
                    {order.shipping_address && (
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-brand-primary" />
                                    Alamat Pengiriman
                                </h2>
                            </div>
                            <div className="p-4">
                                <p className="font-bold text-slate-900 dark:text-white">
                                    {order.shipping_address.recipient_name}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 mt-1">
                                    {order.shipping_address.phone}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 mt-2">
                                    {order.shipping_address.full_address}
                                    {order.shipping_address.postal_code && ` - ${order.shipping_address.postal_code}`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Tracking Info */}
                    {order.tracking_number && (
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Truck className="w-5 h-5 text-brand-primary" />
                                    Informasi Pengiriman
                                </h2>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Kurir</span>
                                    <span className="font-medium text-slate-900 dark:text-white">
                                        {order.shipping_provider || "-"}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">No. Resi</span>
                                    <span className="font-mono font-medium text-brand-primary">
                                        {order.tracking_number}
                                    </span>
                                </div>
                                {order.shipped_at && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Tanggal Kirim</span>
                                        <span className="font-medium text-slate-900 dark:text-white">
                                            {formatDate(order.shipped_at)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column - Order Summary */}
                <div className="space-y-6">
                    {/* Seller Info */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Store className="w-5 h-5 text-brand-primary" />
                                Informasi Penjual
                            </h2>
                        </div>
                        <div className="p-4">
                            <p className="font-bold text-slate-900 dark:text-white">
                                {order.seller?.store_name || order.seller?.name || "Seller"}
                            </p>
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                            <h2 className="font-bold text-slate-900 dark:text-white">
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
                                <span className="font-bold text-slate-900 dark:text-white">Total</span>
                                <span className="font-bold text-brand-primary text-lg">
                                    {formatPrice(order.total)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Order Date Info */}
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="p-4 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Tanggal Order</span>
                                <span className="text-slate-900 dark:text-white">
                                    {formatDate(order.created_at)}
                                </span>
                            </div>
                            {order.updated_at && order.updated_at !== order.created_at && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Terakhir Update</span>
                                    <span className="text-slate-900 dark:text-white">
                                        {formatDate(order.updated_at)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-white/5">
                                <h2 className="font-bold text-slate-900 dark:text-white">
                                    Catatan
                                </h2>
                            </div>
                            <div className="p-4">
                                <p className="text-slate-600 dark:text-slate-400">
                                    {order.notes}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
