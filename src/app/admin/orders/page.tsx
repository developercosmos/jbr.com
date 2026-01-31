import Link from "next/link";
import { Search, Filter, Download, Eye, MoreHorizontal, ArrowUpDown, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle, Package } from "lucide-react";
import { getAdminOrders } from "@/actions/admin";

function formatPrice(price: string) {
    const num = parseFloat(price);
    if (isNaN(num)) return "Rp 0";

    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(num);
}

function formatDate(date: Date) {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

const statusConfig: Record<string, { label: string; bg: string; text: string; ring: string }> = {
    PENDING_PAYMENT: { label: "Pending", bg: "bg-yellow-50", text: "text-yellow-700", ring: "ring-yellow-600/20" },
    PAID: { label: "Paid", bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-600/20" },
    PROCESSING: { label: "Processing", bg: "bg-blue-50", text: "text-blue-700", ring: "ring-blue-600/20" },
    SHIPPED: { label: "Shipped", bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-600/20" },
    DELIVERED: { label: "Delivered", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-600/20" },
    COMPLETED: { label: "Completed", bg: "bg-green-50", text: "text-green-700", ring: "ring-green-600/20" },
    CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700", ring: "ring-red-600/20" },
    REFUNDED: { label: "Refunded", bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-600/20" },
};

export default async function AdminOrdersPage() {
    let orders: any[] = [];
    let errorMsg = null;

    try {
        orders = await getAdminOrders();
    } catch (error: any) {
        console.error("Failed to fetch admin orders:", error);
        errorMsg = error.message || "An unknown error occurred while fetching orders.";
    }

    if (errorMsg) {
        return (
            <div className="absolute top-0 left-0 w-full h-screen flex items-center justify-center bg-slate-50 dark:bg-black/20 z-10">
                <div className="bg-white dark:bg-surface-dark p-6 rounded-2xl border border-red-200 dark:border-red-900 shadow-lg max-w-md text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Error Loading Orders</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{errorMsg}</p>
                    <Link
                        href="/admin"
                        className="inline-flex px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-medium text-sm hover:opacity-90 transition-opacity"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none dark:from-white/5 dark:to-transparent"></div>
            <div className="container mx-auto max-w-[1600px] p-6 lg:p-10 flex flex-col gap-8 relative z-0">
                {/* Header */}
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <nav aria-label="Breadcrumb" className="flex mb-3">
                            <ol className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                                <li>
                                    <Link
                                        href="/admin"
                                        className="hover:text-brand-primary transition-colors"
                                    >
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <span className="text-slate-300 dark:text-slate-600">/</span>
                                </li>
                                <li>
                                    <span className="font-medium text-brand-primary">
                                        Orders
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            Transactions & Orders
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Monitor and manage all platform transactions.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                            <Download className="w-5 h-5" />
                            Export Report
                        </button>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-sm">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-primary transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search ID, Seller, or Buyer..."
                            className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary sm:text-sm transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:border-brand-primary hover:text-brand-primary transition-colors text-sm font-medium whitespace-nowrap">
                            <Filter className="w-4 h-4" />
                            Filter Status
                        </button>
                        <div className="relative">
                            <select className="px-4 py-2.5 pr-8 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary text-sm font-medium cursor-pointer appearance-none">
                                <option>All Categories</option>
                                <option>Rackets</option>
                                <option>Shoes</option>
                                <option>Accessories</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        {!orders || orders.length === 0 ? (
                            <div className="text-center py-16">
                                <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                    No Orders Found
                                </h3>
                                <p className="text-slate-500">
                                    There are no transactions recorded yet.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 font-heading">
                                        <th className="px-6 py-4 font-semibold">
                                            <div className="flex items-center gap-2 cursor-pointer hover:text-brand-primary transition-colors">
                                                Transaction ID
                                                <ArrowUpDown className="w-3 h-3" />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4">Seller</th>
                                        <th className="px-6 py-4">Buyer</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4 text-right">Total</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {orders.map((order) => {
                                        const statusKey = String(order.status);
                                        const status = statusConfig[statusKey] || { label: statusKey, bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-600" };
                                        return (
                                            <tr key={order.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-5 text-sm font-mono text-brand-primary font-bold">
                                                    #{order.order_number}
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">
                                                            {order.seller?.store_name?.slice(0, 2).toUpperCase() || "??"}
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-900 dark:text-white">{order.seller?.store_name || "Unknown Seller"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                                                    {order.buyer?.name || "Unknown Buyer"}
                                                </td>
                                                <td className="px-6 py-5 text-sm text-slate-500">
                                                    {formatDate(order.created_at)}
                                                </td>
                                                <td className="px-6 py-5 text-sm font-bold text-right text-slate-900 dark:text-white font-heading">
                                                    {formatPrice(String(order.total_amount))}
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${status.bg} ${status.text} ring-1 ring-inset ${status.ring}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors" title="View Details">
                                                            <Eye className="w-4 h-4" />
                                                        </button>
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
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
