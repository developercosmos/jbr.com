"use client";

import { useState } from "react";
import { Eye, MoreHorizontal, X, Package, User, MapPin, Truck, FileText, CheckCircle, XCircle, Clock } from "lucide-react";

interface OrderItem {
    id: string;
    quantity: number;
    price: string;
    product?: {
        id: string;
        title: string;
        slug: string;
        images: string[] | null;
    } | null;
}

interface Order {
    id: string;
    order_number: string;
    status: string;
    subtotal: string;
    shipping_cost: string | null;
    total: string;
    notes: string | null;
    tracking_number: string | null;
    shipping_provider: string | null;
    created_at: Date;
    buyer?: { id: string; name: string | null; email: string } | null;
    seller?: { id: string; name: string | null; store_name: string | null } | null;
    items?: OrderItem[];
}

interface OrderActionsProps {
    order: Order;
}

function formatPrice(price: string | number) {
    const num = typeof price === "string" ? parseFloat(price) : price;
    if (isNaN(num)) return "Rp 0";
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(num);
}

function formatDate(date: Date) {
    if (!date) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(date));
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    PENDING_PAYMENT: { label: "Menunggu Pembayaran", color: "text-yellow-600", icon: Clock },
    PAID: { label: "Dibayar", color: "text-emerald-600", icon: CheckCircle },
    PROCESSING: { label: "Diproses", color: "text-blue-600", icon: Package },
    SHIPPED: { label: "Dikirim", color: "text-indigo-600", icon: Truck },
    DELIVERED: { label: "Diterima", color: "text-green-600", icon: CheckCircle },
    COMPLETED: { label: "Selesai", color: "text-green-600", icon: CheckCircle },
    CANCELLED: { label: "Dibatalkan", color: "text-red-600", icon: XCircle },
    REFUNDED: { label: "Refunded", color: "text-slate-600", icon: XCircle },
};

export function OrderActions({ order }: OrderActionsProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const status = statusConfig[order.status] || { label: order.status, color: "text-slate-600", icon: Package };
    const StatusIcon = status.icon;

    return (
        <>
            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors"
                    title="View Details"
                >
                    <Eye className="w-4 h-4" />
                </button>
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-20">
                                <button
                                    onClick={() => {
                                        setIsModalOpen(true);
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Lihat Detail
                                </button>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(order.order_number);
                                        setShowMenu(false);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                                >
                                    Copy Order ID
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Order Detail Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                    Detail Pesanan
                                </h2>
                                <p className="text-sm text-slate-500 font-mono">#{order.order_number}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Status */}
                            <div className="flex items-center gap-3">
                                <StatusIcon className={`w-6 h-6 ${status.color}`} />
                                <div>
                                    <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                                    <p className={`font-bold ${status.color}`}>{status.label}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-xs text-slate-500">Tanggal Order</p>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                        {formatDate(order.created_at)}
                                    </p>
                                </div>
                            </div>

                            {/* Parties */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User className="w-4 h-4 text-slate-400" />
                                        <p className="text-xs text-slate-500 font-medium uppercase">Pembeli</p>
                                    </div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {order.buyer?.name || "Unknown"}
                                    </p>
                                    <p className="text-sm text-slate-500">{order.buyer?.email || "-"}</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-4 h-4 text-slate-400" />
                                        <p className="text-xs text-slate-500 font-medium uppercase">Penjual</p>
                                    </div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                        {order.seller?.store_name || order.seller?.name || "Unknown"}
                                    </p>
                                </div>
                            </div>

                            {/* Tracking Info */}
                            {order.tracking_number && (
                                <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                                    <Truck className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <p className="text-xs text-blue-600 font-medium uppercase">Info Pengiriman</p>
                                        <p className="font-mono font-bold text-blue-800 dark:text-blue-300">
                                            {order.shipping_provider}: {order.tracking_number}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Items */}
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Produk ({order.items?.length || 0})
                                </h3>
                                <div className="space-y-2">
                                    {order.items?.map((item) => (
                                        <div
                                            key={item.id}
                                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                                        >
                                            <div className="flex items-center gap-3">
                                                {item.product?.images?.[0] ? (
                                                    <img
                                                        src={item.product.images[0]}
                                                        alt={item.product.title}
                                                        className="w-12 h-12 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                                                        <Package className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-slate-900 dark:text-white text-sm">
                                                        {item.product?.title || "Product"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {item.quantity}x @ {formatPrice(item.price)}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="font-bold text-slate-900 dark:text-white">
                                                {formatPrice(parseFloat(item.price) * item.quantity)}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="text-slate-900 dark:text-white">{formatPrice(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Ongkos Kirim</span>
                                    <span className="text-slate-900 dark:text-white">
                                        {formatPrice(order.shipping_cost || "0")}
                                    </span>
                                </div>
                                <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200 dark:border-slate-700">
                                    <span className="text-slate-900 dark:text-white">Total</span>
                                    <span className="text-brand-primary">{formatPrice(order.total)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {order.notes && (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                                    <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium uppercase mb-1">
                                        Catatan
                                    </p>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-300">{order.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-2.5 px-4 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
