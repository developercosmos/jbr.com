import Link from "next/link";
import Image from "next/image";
import { Search, Filter, Download, Eye, MoreHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, Package, Truck, CheckCircle, Clock, CreditCard, XCircle } from "lucide-react";
import { getSellerOrders } from "@/actions/orders";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
        label: "Perlu Dikirim",
        icon: <Package className="w-3 h-3 mr-1" />,
        bg: "bg-orange-100 dark:bg-orange-900/30",
        text: "text-orange-800 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-700/50"
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

export default async function SellerOrdersPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const orders = await getSellerOrders();

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Daftar Pesanan
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola semua pesanan masuk dan status pengiriman.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium">
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                    <div className="relative w-full md:w-96">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Cari ID Pesanan, Nama Pembeli..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap">
                            <Filter className="w-4 h-4" />
                            Filter Status
                        </button>
                        <select className="px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-medium cursor-pointer">
                            <option>Semua Waktu</option>
                            <option>Hari Ini</option>
                            <option>7 Hari Terakhir</option>
                            <option>30 Hari Terakhir</option>
                        </select>
                    </div>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                        <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Belum ada pesanan
                        </h3>
                        <p className="text-slate-500">
                            Pesanan dari pembeli akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 font-semibold">
                                            <div className="flex items-center gap-2 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                                                ID Pesanan
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 font-semibold">Produk</th>
                                        <th className="px-6 py-4 font-semibold">Pembeli</th>
                                        <th className="px-6 py-4 font-semibold">Tanggal</th>
                                        <th className="px-6 py-4 font-semibold text-right">Total</th>
                                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                                        <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {orders.map((order) => {
                                        const firstItem = order.items[0];
                                        const status = statusConfig[order.status] || statusConfig.PENDING_PAYMENT;

                                        return (
                                            <tr key={order.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-4 text-sm font-mono text-brand-primary font-medium">
                                                    {order.order_number}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {firstItem && (
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                                {firstItem.product?.images && firstItem.product.images.length > 0 ? (
                                                                    <Image
                                                                        src={firstItem.product.images[0]}
                                                                        alt={firstItem.product.title}
                                                                        fill
                                                                        className="object-cover"
                                                                    />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center">
                                                                        <Package className="w-5 h-5 text-slate-400" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-medium text-slate-900 dark:text-white text-sm truncate max-w-[150px]">
                                                                    {firstItem.product?.title || "Produk"}
                                                                </span>
                                                                <span className="text-xs text-slate-500">
                                                                    {order.items.length > 1 ? `+${order.items.length - 1} lainnya` : `x${firstItem.quantity}`}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                                                    {order.buyer?.name || "Pembeli"}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500">
                                                    {formatDate(order.created_at)}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-right text-slate-900 dark:text-white">
                                                    {formatPrice(order.total)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>
                                                        {status.icon}
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <Link
                                                            href={`/seller/orders/${order.id}`}
                                                            className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                                                            title="Lihat Detail"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Link>
                                                        <button className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <span className="text-sm text-slate-500">
                                Menampilkan <span className="font-medium text-slate-900 dark:text-white">{orders.length}</span> pesanan
                            </span>
                            <div className="flex gap-2">
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
