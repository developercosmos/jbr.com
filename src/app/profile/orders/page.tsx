import Link from "next/link";
import Image from "next/image";
import { Search, Package, Truck, CheckCircle, Clock, XCircle, CreditCard } from "lucide-react";
import { getBuyerOrders } from "@/actions/orders";

const statusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
    PENDING_PAYMENT: {
        label: "Menunggu Pembayaran",
        icon: <CreditCard className="w-3 h-3 mr-1" />,
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-800 dark:text-yellow-300",
        border: "border-yellow-200 dark:border-yellow-700/50"
    },
    PAID: {
        label: "Dibayar",
        icon: <CheckCircle className="w-3 h-3 mr-1" />,
        bg: "bg-emerald-100 dark:bg-emerald-900/30",
        text: "text-emerald-800 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-700/50"
    },
    PROCESSING: {
        label: "Diproses",
        icon: <Package className="w-3 h-3 mr-1" />,
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700/50"
    },
    SHIPPED: {
        label: "Sedang Dikirim",
        icon: <Truck className="w-3 h-3 mr-1" />,
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-800 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-700/50"
    },
    DELIVERED: {
        label: "Sampai Tujuan",
        icon: <CheckCircle className="w-3 h-3 mr-1" />,
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        border: "border-green-200 dark:border-green-700/50"
    },
    COMPLETED: {
        label: "Selesai",
        icon: <CheckCircle className="w-3 h-3 mr-1" />,
        bg: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-800 dark:text-green-300",
        border: "border-green-200 dark:border-green-700/50"
    },
    CANCELLED: {
        label: "Dibatalkan",
        icon: <XCircle className="w-3 h-3 mr-1" />,
        bg: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-800 dark:text-red-300",
        border: "border-red-200 dark:border-red-700/50"
    },
    REFUNDED: {
        label: "Dikembalikan",
        icon: <Clock className="w-3 h-3 mr-1" />,
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
        month: "short",
        year: "numeric",
    }).format(date);
}

export default async function ProfileOrdersPage() {
    const orders = await getBuyerOrders();

    return (
        <div className="flex-1">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-2">
                    Pesanan Saya
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Riwayat belanja dan status pesanan Anda.
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    placeholder="Cari pesanan berdasarkan nama produk atau ID..."
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-white dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all shadow-sm"
                />
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                    <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        Belum ada pesanan
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Anda belum melakukan pembelian apapun.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
                    >
                        Mulai Belanja
                    </Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {orders.map((order) => {
                        const firstItem = order.items[0];
                        const status = statusConfig[order.status] || statusConfig.PENDING_PAYMENT;

                        return (
                            <div key={order.id} className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800/50 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/5">
                                    <div className="flex items-center gap-4 text-sm">
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {formatDate(order.created_at)}
                                        </span>
                                        <span className="text-slate-400">|</span>
                                        <span className="font-mono text-slate-500">{order.order_number}</span>
                                        <span className="text-slate-400">|</span>
                                        <span className="text-slate-600 dark:text-slate-300">
                                            {order.seller?.store_name || order.seller?.name || "Seller"}
                                        </span>
                                    </div>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${status.bg} ${status.text} border ${status.border} uppercase tracking-wide`}>
                                        {status.icon}
                                        {status.label}
                                    </span>
                                </div>
                                <div className="p-4 flex flex-col sm:flex-row gap-4">
                                    {firstItem && (
                                        <>
                                            <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800">
                                                {firstItem.product?.images && firstItem.product.images.length > 0 ? (
                                                    <Image
                                                        src={firstItem.product.images[0]}
                                                        alt={firstItem.product.title}
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
                                                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-1">
                                                    {firstItem.product?.title || "Produk"}
                                                </h3>
                                                <p className="text-sm text-slate-500 mb-2">
                                                    {firstItem.quantity} x {formatPrice(firstItem.price)}
                                                    {order.items.length > 1 && (
                                                        <span className="ml-2 text-brand-primary">
                                                            +{order.items.length - 1} produk lainnya
                                                        </span>
                                                    )}
                                                </p>
                                                <div className="flex items-center justify-between mt-4">
                                                    <div>
                                                        <p className="text-xs text-slate-500">Total Belanja</p>
                                                        <p className="font-bold text-brand-primary text-lg">
                                                            {formatPrice(order.total)}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Link
                                                            href={`/profile/orders/${order.id}`}
                                                            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                                        >
                                                            Detail
                                                        </Link>
                                                        {order.status === "SHIPPED" && (
                                                            <button className="px-4 py-2 rounded-lg bg-brand-primary text-white font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20">
                                                                Diterima
                                                            </button>
                                                        )}
                                                        {order.status === "COMPLETED" && firstItem.product && (
                                                            <Link
                                                                href={`/product/${firstItem.product.slug}`}
                                                                className="px-4 py-2 rounded-lg border border-brand-primary text-brand-primary font-bold text-sm hover:bg-brand-primary/5 transition-colors"
                                                            >
                                                                Beli Lagi
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
