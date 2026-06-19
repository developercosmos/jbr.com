import Link from "next/link";
import Image from "next/image";
import { Download, Eye, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Package, Truck, CheckCircle, Clock, CreditCard, XCircle } from "lucide-react";
import { getSellerOrders, type SellerOrderStatus } from "@/actions/orders";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORDER_TABS, parseSellerOrderParams } from "@/lib/seller-orders-query";
import { SellerOrderFilters } from "@/components/seller/SellerOrderFilters";
import { OrderRowActions } from "@/components/seller/OrderRowActions";

const PAGE_SIZE = 20;

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

export default async function SellerOrdersPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | undefined>>;
}) {
    const sp = await searchParams;
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const sellerProfile = await getSellerProfileByUserId(session.user.id);
    if (!sellerProfile?.store_name || !sellerProfile.store_slug || !canAccessSellerCenter(sellerProfile.store_status)) {
        redirect("/seller/register");
    }

    const p = parseSellerOrderParams(sp);
    const { orders, total, statusCounts, page, totalPages } = await getSellerOrders({
        status: p.statuses as SellerOrderStatus[] | undefined,
        q: p.q,
        from: p.from,
        to: p.to,
        sortBy: p.sortBy,
        sortDir: p.sortDir,
        page: p.page,
        limit: PAGE_SIZE,
    });

    // Build a /seller/orders href preserving the current view, applying overrides.
    function buildHref(overrides: Record<string, string | undefined>) {
        const baseParams: Record<string, string | undefined> = {
            status: p.activeKey === "all" ? undefined : p.activeKey,
            q: p.q || undefined,
            range: p.range !== "all" ? p.range : undefined,
            sort: p.sortBy !== "date" ? p.sortBy : undefined,
            dir: p.sortDir !== "desc" ? p.sortDir : undefined,
            page: page > 1 ? String(page) : undefined,
        };
        const merged = { ...baseParams, ...overrides };
        const out = new URLSearchParams();
        for (const [key, value] of Object.entries(merged)) if (value) out.set(key, value);
        const qs = out.toString();
        return qs ? `/seller/orders?${qs}` : "/seller/orders";
    }

    const tabCount = (statuses: string[] | null) =>
        statuses ? statuses.reduce((sum, st) => sum + (statusCounts[st] ?? 0), 0) : statusCounts.__all ?? 0;

    // Export link mirrors the current filters (minus pagination).
    const exportParams = new URLSearchParams();
    if (p.activeKey !== "all") exportParams.set("status", p.activeKey);
    if (p.q) exportParams.set("q", p.q);
    if (p.range !== "all") exportParams.set("range", p.range);
    if (p.sortBy !== "date") exportParams.set("sort", p.sortBy);
    if (p.sortDir !== "desc") exportParams.set("dir", p.sortDir);
    const exportHref = `/api/seller/orders/export${exportParams.toString() ? `?${exportParams}` : ""}`;

    const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(page * PAGE_SIZE, total);

    const SortHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: "order_number" | "date" | "total"; align?: "left" | "right" }) => {
        const isActive = p.sortBy === sortKey;
        const nextDir = isActive && p.sortDir === "asc" ? "desc" : "asc";
        return (
            <Link
                href={buildHref({ sort: sortKey, dir: nextDir, page: undefined })}
                className={cn(
                    "flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-200 transition-colors",
                    align === "right" && "justify-end"
                )}
            >
                {label}
                {isActive ? (
                    p.sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-brand-primary" /> : <ArrowDown className="w-3 h-3 text-brand-primary" />
                ) : (
                    <ArrowUpDown className="w-3 h-3" />
                )}
            </Link>
        );
    };

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
                        <a
                            href={exportHref}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-sm font-medium"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </a>
                    </div>
                </div>

                {/* Status tabs — filter by order lifecycle bucket */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {ORDER_TABS.map((tab) => {
                        const active = tab.key === p.activeKey;
                        const count = tabCount(tab.statuses);
                        return (
                            <Link
                                key={tab.key}
                                href={buildHref({ status: tab.key === "all" ? undefined : tab.key, page: undefined })}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors",
                                    active
                                        ? "bg-brand-primary text-white border-brand-primary shadow-sm"
                                        : "bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-brand-primary hover:text-brand-primary"
                                )}
                            >
                                {tab.label}
                                <span
                                    className={cn(
                                        "inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold",
                                        active ? "bg-white/25 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                    )}
                                >
                                    {count}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Search + date range */}
                <SellerOrderFilters />

                {orders.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                        <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            {total === 0 && !p.q && p.activeKey === "all" && p.range === "all" ? "Belum ada pesanan" : "Tidak ada pesanan"}
                        </h3>
                        <p className="text-slate-500">
                            {total === 0 && !p.q && p.activeKey === "all" && p.range === "all"
                                ? "Pesanan dari pembeli akan muncul di sini."
                                : "Tidak ada pesanan yang cocok dengan filter ini."}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                                        <th className="px-6 py-4 font-semibold">
                                            <SortHeader label="ID Pesanan" sortKey="order_number" />
                                        </th>
                                        <th className="px-6 py-4 font-semibold">Produk</th>
                                        <th className="px-6 py-4 font-semibold">Pembeli</th>
                                        <th className="px-6 py-4 font-semibold">
                                            <SortHeader label="Tanggal" sortKey="date" />
                                        </th>
                                        <th className="px-6 py-4 font-semibold text-right">
                                            <SortHeader label="Total" sortKey="total" align="right" />
                                        </th>
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
                                                        <OrderRowActions orderId={order.id} orderNumber={order.order_number} status={order.status} />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {/* Pagination */}
                        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                            <span className="text-sm text-slate-500">
                                Menampilkan <span className="font-medium text-slate-900 dark:text-white">{rangeStart}–{rangeEnd}</span> dari{" "}
                                <span className="font-medium text-slate-900 dark:text-white">{total}</span> pesanan
                                <span className="text-slate-400"> · Hal {page}/{totalPages}</span>
                            </span>
                            <div className="flex gap-2">
                                {page > 1 ? (
                                    <Link
                                        href={buildHref({ page: page - 1 > 1 ? String(page - 1) : undefined })}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                        aria-label="Halaman sebelumnya"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <span className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                                        <ChevronLeft className="w-4 h-4" />
                                    </span>
                                )}
                                {page < totalPages ? (
                                    <Link
                                        href={buildHref({ page: String(page + 1) })}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                                        aria-label="Halaman berikutnya"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </Link>
                                ) : (
                                    <span className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                                        <ChevronRight className="w-4 h-4" />
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
