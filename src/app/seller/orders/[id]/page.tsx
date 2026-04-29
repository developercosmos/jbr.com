import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { getOrderById, updateOrderStatus } from "@/actions/orders";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Package, MapPin, User, Clock } from "lucide-react";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const statusConfig: Record<string, { label: string; className: string }> = {
    PENDING_PAYMENT: { label: "Menunggu Pembayaran", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" },
    PAID: { label: "Dibayar", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    PROCESSING: { label: "Diproses", className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
    SHIPPED: { label: "Dikirim", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    DELIVERED: { label: "Diterima", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
    COMPLETED: { label: "Selesai", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    CANCELLED: { label: "Dibatalkan", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    REFUNDED: { label: "Dikembalikan", className: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300" },
};

function formatPrice(amount: string | number) {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(
        typeof amount === "string" ? parseFloat(amount) : amount
    );
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

const NEXT_STATUSES: Record<string, { value: string; label: string; className: string }[]> = {
    PAID: [{ value: "PROCESSING", label: "Proses Pesanan", className: "bg-indigo-600 hover:bg-indigo-700 text-white" }],
    PROCESSING: [
        { value: "SHIPPED", label: "Tandai Sudah Dikirim", className: "bg-purple-600 hover:bg-purple-700 text-white" },
        { value: "CANCELLED", label: "Batalkan", className: "bg-red-600 hover:bg-red-700 text-white" },
    ],
    SHIPPED: [{ value: "DELIVERED", label: "Tandai Diterima", className: "bg-teal-600 hover:bg-teal-700 text-white" }],
};

export default async function SellerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const sellerProfile = await getSellerProfileByUserId(session.user.id);
    if (!sellerProfile?.store_name || !sellerProfile.store_slug || !canAccessSellerCenter(sellerProfile.store_status)) {
        redirect("/seller/register");
    }

    let order: Awaited<ReturnType<typeof getOrderById>> | null = null;
    try {
        order = await getOrderById(id);
    } catch {
        notFound();
    }

    if (!order) notFound();

    // Verify this order belongs to the current seller
    if (order.seller_id !== session.user.id) notFound();

    const status = statusConfig[order.status] ?? statusConfig.PENDING_PAYMENT;
    const nextActions = NEXT_STATUSES[order.status] ?? [];

    async function handleUpdateStatus(formData: FormData) {
        "use server";
        const newStatus = formData.get("status") as string;
        if (!newStatus) return;
        try {
            await updateOrderStatus(id, newStatus as Parameters<typeof updateOrderStatus>[1]);
        } catch { /* handled by redirect */ }
        revalidatePath(`/seller/orders/${id}`);
        revalidatePath("/seller/orders");
    }

    return (
        <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/seller/orders" className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-slate-500">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white uppercase">
                            Pesanan #{order.order_number}
                        </h1>
                        <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(order.created_at)}
                        </p>
                    </div>
                    <span className={`ml-auto inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${status.className}`}>
                        {status.label}
                    </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left — Items + Actions */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Order Items */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                                <h2 className="font-bold text-slate-900 dark:text-white">Item Pesanan</h2>
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                {order.items.map((item) => (
                                    <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                                        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                            {item.product?.images?.[0] ? (
                                                <Image src={item.product.images[0]} alt={item.product.title} fill className="object-cover" sizes="64px" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Package className="w-6 h-6 text-slate-400" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-slate-900 dark:text-white truncate">{item.product?.title ?? "Produk"}</p>
                                            <p className="text-sm text-slate-500">Qty: {item.quantity}</p>
                                            <p className="text-sm font-medium text-brand-primary">{formatPrice(item.price)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-slate-900 dark:text-white">{formatPrice(parseFloat(item.price) * item.quantity)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20 flex justify-between items-center">
                                <span className="font-bold text-slate-900 dark:text-white">Total Pesanan</span>
                                <span className="text-xl font-bold text-brand-primary">{formatPrice(order.total)}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        {nextActions.length > 0 && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-4">Aksi Pesanan</h2>
                                <div className="flex flex-wrap gap-3">
                                    {nextActions.map((action) => (
                                        <form key={action.value} action={handleUpdateStatus}>
                                            <input type="hidden" name="status" value={action.value} />
                                            <button type="submit" className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${action.className}`}>
                                                {action.label}
                                            </button>
                                        </form>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right — Buyer & Shipping Info */}
                    <div className="space-y-6">
                        {/* Buyer Info */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <User className="w-4 h-4" />Informasi Pembeli
                            </h2>
                            <div className="space-y-2 text-sm">
                                <p className="font-medium text-slate-900 dark:text-white">{order.buyer?.name ?? "Pembeli"}</p>
                                <p className="text-slate-500">{order.buyer?.email ?? "-"}</p>
                            </div>
                        </div>

                        {/* Shipping Address */}
                        {order.shipping_address && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />Alamat Pengiriman
                                </h2>
                                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                    <p className="font-medium text-slate-900 dark:text-white">{order.shipping_address.recipient_name}</p>
                                    <p>{order.shipping_address.phone}</p>
                                    <p>{order.shipping_address.full_address}</p>
                                    {order.shipping_address.postal_code && <p>Kode Pos: {order.shipping_address.postal_code}</p>}
                                </div>
                            </div>
                        )}

                        {/* Payment Summary */}
                        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                            <h2 className="font-bold text-slate-900 dark:text-white mb-4">Ringkasan Pembayaran</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                    <span>Subtotal</span>
                                    <span>{formatPrice(order.subtotal ?? order.total)}</span>
                                </div>
                                {order.shipping_cost && parseFloat(order.shipping_cost) > 0 && (
                                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                                        <span>Ongkir</span>
                                        <span>{formatPrice(order.shipping_cost)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between font-bold text-slate-900 dark:text-white border-t border-slate-200 dark:border-slate-800 pt-2 mt-2">
                                    <span>Total</span>
                                    <span>{formatPrice(order.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
