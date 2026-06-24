import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { getOrderById, updateOrderStatus } from "@/actions/orders";
import { updateShippingInfo } from "@/actions/shipping";
import { getBiteshipRatesForOrder, requestBiteshipPickup, syncBiteshipOrderStatus } from "@/actions/shipping-biteship";
import { sellerCancelOrder } from "@/actions/refunds";
import { getSellerInteractionRatingForContext } from "@/actions/reputation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Package, MapPin, User, Clock, Truck } from "lucide-react";
import { revalidatePath } from "next/cache";
import BuyerInteractionRatingCard from "./BuyerInteractionRatingCard";

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
    // PROCESSING → SHIPPED is handled by the dedicated "Kirim Pesanan" form below
    // (captures courier + resi via updateShippingInfo and notifies the buyer).
    // Cancellation is a separate action (sellerCancelOrder) — NOT a status button,
    // because PAID/PROCESSING cancels must also restock + refund, not just flip status.
    PROCESSING: [],
    // After SHIPPED the seller has no further status action: the BUYER confirms
    // receipt (sets DELIVERED + arms escrow), then funds auto-release. Letting the
    // seller self-mark DELIVERED would release escrow without the buyer receiving
    // the goods, so it is intentionally not offered here.
    SHIPPED: [],
};

export default async function SellerOrderDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ bsError?: string }>;
}) {
    const { id } = await params;
    const { bsError } = await searchParams;

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

    const buyer = Array.isArray(order.buyer) ? (order.buyer[0] ?? null) : order.buyer;
    const shippingAddress = Array.isArray(order.shipping_address) ? (order.shipping_address[0] ?? null) : order.shipping_address;

    const status = statusConfig[order.status] ?? statusConfig.PENDING_PAYMENT;
    const nextActions = NEXT_STATUSES[order.status] ?? [];
    const existingBuyerInteractionRating = order.buyer_id
        ? await getSellerInteractionRatingForContext("ORDER", order.id, order.buyer_id).catch(() => null)
        : null;

    // Biteship booking context: live rate options when the order is bookable.
    // Null when the integration is off, already booked, or not in a shippable state.
    const biteshipRates =
        (order.status === "PAID" || order.status === "PROCESSING") && !order.biteship_order_id
            ? await getBiteshipRatesForOrder(order.id).catch(() => null)
            : null;

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

    async function handleShip(formData: FormData) {
        "use server";
        const shippingProvider = String(formData.get("shippingProvider") || "").trim();
        const trackingNumber = String(formData.get("trackingNumber") || "").trim();
        const estimatedDelivery = String(formData.get("estimatedDelivery") || "").trim() || undefined;
        if (!shippingProvider || !trackingNumber) return;
        try {
            await updateShippingInfo({ orderId: id, trackingNumber, shippingProvider, estimatedDelivery });
        } catch { /* validation/ownership errors surface on refresh */ }
        revalidatePath(`/seller/orders/${id}`);
        revalidatePath("/seller/orders");
    }

    async function handleCancel() {
        "use server";
        const res = await sellerCancelOrder({ orderId: id });
        if (!res.success) {
            redirect(`/seller/orders/${id}?bsError=${encodeURIComponent(res.error)}`);
        }
        revalidatePath(`/seller/orders/${id}`);
        revalidatePath("/seller/orders");
    }

    async function handleBiteshipBook(formData: FormData) {
        "use server";
        const choice = String(formData.get("courierChoice") || "");
        const [courierCompany, courierType] = choice.split("|");
        if (!courierCompany || !courierType) return;
        let errMsg: string | null = null;
        try {
            await requestBiteshipPickup({ orderId: id, courierCompany, courierType });
        } catch (e) {
            errMsg = e instanceof Error ? e.message : "Gagal booking pickup Biteship.";
        }
        revalidatePath(`/seller/orders/${id}`);
        revalidatePath("/seller/orders");
        if (errMsg) {
            redirect(`/seller/orders/${id}?bsError=${encodeURIComponent(errMsg.slice(0, 180))}`);
        }
    }

    async function handleBiteshipSync() {
        "use server";
        let errMsg: string | null = null;
        try {
            await syncBiteshipOrderStatus(id);
        } catch (e) {
            errMsg = e instanceof Error ? e.message : "Gagal memperbarui status.";
        }
        revalidatePath(`/seller/orders/${id}`);
        if (errMsg) {
            redirect(`/seller/orders/${id}?bsError=${encodeURIComponent(errMsg.slice(0, 180))}`);
        }
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
                        {bsError && (
                            <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-sm text-rose-700 dark:text-rose-300">
                                {bsError}
                            </div>
                        )}

                        {/* Cancel — pre-shipment only; restocks + flags refund + notifies buyer */}
                        {(order.status === "PAID" || order.status === "PROCESSING") && !order.biteship_order_id && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-rose-200 dark:border-rose-900/50 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-1">Batalkan Pesanan</h2>
                                <p className="text-xs text-slate-500 mb-4">
                                    Gunakan bila stok habis / pesanan tak dapat dipenuhi. Stok dikembalikan, pembeli
                                    dinotifikasi, dan dana ditandai untuk dikembalikan (status menjadi Dikembalikan).
                                    Tidak dapat dibatalkan setelah pesanan dikirim.
                                </p>
                                <form action={handleCancel}>
                                    <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-sm bg-rose-600 hover:bg-rose-700 text-white transition-colors">
                                        Batalkan &amp; Refund Pembeli
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Biteship: booked-pickup status card */}
                        {order.biteship_order_id && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    <Truck className="w-4 h-4" /> Pickup Biteship
                                </h2>
                                <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1 mb-4">
                                    <p>Kurir: <span className="font-medium text-slate-900 dark:text-white">{order.shipping_provider ?? "-"}</span></p>
                                    <p>No. Resi: <span className="font-mono text-slate-900 dark:text-white">{order.tracking_number ?? "menunggu kurir"}</span></p>
                                    <p className="text-xs text-slate-400">ID Biteship: {order.biteship_order_id}</p>
                                    <p className="text-xs text-slate-500">
                                        Status pesanan diperbarui otomatis dari kurir (pickup → Dikirim, sampai → Diterima).
                                    </p>
                                </div>
                                <form action={handleBiteshipSync}>
                                    <button type="submit" className="px-4 py-2 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand-primary/50 transition-colors">
                                        Perbarui Status dari Biteship
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Biteship: book-a-pickup panel (only when integration is configured) */}
                        {!order.biteship_order_id && biteshipRates?.configured && (order.status === "PAID" || order.status === "PROCESSING") && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-emerald-600" /> Request Pickup (Biteship)
                                </h2>
                                <p className="text-xs text-slate-500 mb-4">
                                    Kurir menjemput paket ke alamat pickup Anda. Resi terisi otomatis dan status pesanan
                                    mengikuti tracking kurir — tanpa input manual.
                                </p>
                                {biteshipRates.available ? (
                                    <form action={handleBiteshipBook} className="space-y-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Layanan kurir</label>
                                            <select
                                                name="courierChoice"
                                                required
                                                defaultValue=""
                                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                            >
                                                <option value="" disabled>Pilih layanan</option>
                                                {biteshipRates.options.map((opt) => (
                                                    <option key={`${opt.courierCompany}|${opt.serviceCode}`} value={`${opt.courierCompany}|${opt.serviceCode}`}>
                                                        {opt.courierName} {opt.serviceName} — {formatPrice(opt.price)} ({opt.duration})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                                            Booking Pickup
                                        </button>
                                        <p className="text-[11px] text-slate-400">
                                            Biaya pickup memakai saldo Biteship platform. Alternatif: kirim sendiri lalu isi resi manual di bawah.
                                        </p>
                                    </form>
                                ) : (
                                    <p className="text-sm text-amber-600">{biteshipRates.reason}</p>
                                )}
                            </div>
                        )}

                        {/* Ship form — captures courier + resi, sets SHIPPED, and notifies the buyer */}
                        {(order.status === "PAID" || order.status === "PROCESSING") && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-1">Kirim Pesanan</h2>
                                <p className="text-xs text-slate-500 mb-4">Masukkan kurir dan nomor resi. Pembeli akan menerima notifikasi pelacakan.</p>
                                <form action={handleShip} className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Kurir</label>
                                            <select
                                                name="shippingProvider"
                                                required
                                                defaultValue=""
                                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                            >
                                                <option value="" disabled>Pilih kurir</option>
                                                <option value="JNE">JNE</option>
                                                <option value="J&T">J&T Express</option>
                                                <option value="SiCepat">SiCepat</option>
                                                <option value="AnterAja">AnterAja</option>
                                                <option value="POS">POS Indonesia</option>
                                                <option value="TIKI">TIKI</option>
                                                <option value="Ninja">Ninja Xpress</option>
                                                <option value="Lainnya">Lainnya</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">No. Resi</label>
                                            <input
                                                name="trackingNumber"
                                                required
                                                placeholder="Mis. JP1234567890"
                                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Estimasi tiba (opsional)</label>
                                        <input
                                            type="date"
                                            name="estimatedDelivery"
                                            className="w-full sm:w-1/2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <button type="submit" className="px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white transition-colors">
                                        Tandai Sudah Dikirim
                                    </button>
                                </form>
                            </div>
                        )}
                        {order.status === "SHIPPED" && (
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
                                Pesanan sudah dikirim. Menunggu pembeli mengonfirmasi penerimaan. Dana akan
                                dirilis otomatis ke saldo Anda setelah masa konfirmasi berakhir.
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
                                <p className="font-medium text-slate-900 dark:text-white">{buyer?.name ?? "Pembeli"}</p>
                                <p className="text-slate-500">{buyer?.email ?? "-"}</p>
                            </div>
                        </div>

                        {/* Shipping Address */}
                        {shippingAddress && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
                                <h2 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <MapPin className="w-4 h-4" />Alamat Pengiriman
                                </h2>
                                <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                    <p className="font-medium text-slate-900 dark:text-white">{shippingAddress.recipient_name}</p>
                                    <p>{shippingAddress.phone}</p>
                                    <p>{shippingAddress.full_address}</p>
                                    {shippingAddress.postal_code && <p>Kode Pos: {shippingAddress.postal_code}</p>}
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

                        {order.status === "COMPLETED" && order.buyer_id && (
                            <BuyerInteractionRatingCard
                                orderId={order.id}
                                buyerId={order.buyer_id}
                                buyerName={buyer?.name ?? "Pembeli"}
                                existing={
                                    existingBuyerInteractionRating
                                        ? {
                                            id: existingBuyerInteractionRating.id,
                                            rating: existingBuyerInteractionRating.rating,
                                            tags: existingBuyerInteractionRating.tags ?? [],
                                            note: existingBuyerInteractionRating.note,
                                            is_disputed: existingBuyerInteractionRating.is_disputed,
                                            edited_until: existingBuyerInteractionRating.edited_until,
                                        }
                                        : null
                                }
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
