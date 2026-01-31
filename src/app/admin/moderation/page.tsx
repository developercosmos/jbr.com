import Link from "next/link";
import Image from "next/image";
import { History, PlayCircle, Hourglass, TrendingUp, Flag, CheckCircle, Timer, ArrowDown, Search, Filter, MoreHorizontal, Ban, Gavel, ChevronDown, Package } from "lucide-react";
import { getModerationQueue, getAdminDashboardStats } from "@/actions/admin";
import { ModerationActions } from "./ModerationActions";

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

function timeAgo(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds} detik lalu`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
    return `${Math.floor(seconds / 86400)} hari lalu`;
}

export default async function ModerationPage() {
    const [stats, pendingProducts] = await Promise.all([
        getAdminDashboardStats(),
        getModerationQueue(),
    ]);

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
                                        Product Moderation
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            Moderation Queue
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Ensure platform quality by reviewing incoming product listings.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                            <History className="w-5 h-5" />
                            History Log
                        </button>
                        <button className="flex items-center gap-2 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-primary/25 hover:bg-blue-600 transition-all">
                            <PlayCircle className="w-5 h-5" />
                            Start Review Session
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Pending */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Pending
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.pendingProducts}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-500">
                                <Hourglass className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Waiting for review</span>
                        </div>
                    </div>
                    {/* Published */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Published
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.publishedProducts}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10 text-green-500">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Active products</span>
                        </div>
                    </div>
                    {/* Moderated */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Moderated
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.moderatedProducts}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10 text-red-500">
                                <Flag className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Rejected</span>
                        </div>
                    </div>
                    {/* Total Users */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Total Users
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.totalUsers}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-brand-primary">
                                <Timer className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                                <TrendingUp className="w-3.5 h-3.5 mr-1" /> +{stats.newUsersThisWeek}
                            </span>
                            <span className="text-slate-400">this week</span>
                        </div>
                    </div>
                </div>

                {/* Filters & Table */}
                <div className="flex flex-col rounded-2xl bg-white dark:bg-surface-dark shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
                    {/* Filters */}
                    <div className="border-b border-slate-100 dark:border-slate-800 p-5 flex flex-col md:flex-row gap-4 items-center justify-between bg-white dark:bg-surface-dark">
                        <div className="relative w-full md:max-w-md group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                                <Search className="w-5 h-5" />
                            </span>
                            <input
                                className="w-full rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-primary focus:ring-brand-primary transition-shadow"
                                placeholder="Search by ID, Product Name, or Seller..."
                                type="text"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <button className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-brand-primary">
                                <Filter className="w-5 h-5" />
                                Filters
                            </button>
                        </div>
                    </div>

                    {pendingProducts.length === 0 ? (
                        <div className="text-center py-16">
                            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Queue is empty
                            </h3>
                            <p className="text-slate-500">
                                No products waiting for moderation.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-black/20 border-b border-slate-100 dark:border-slate-800">
                                        <tr>
                                            <th className="w-14 px-6 py-4">
                                                <input
                                                    className="h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                                    type="checkbox"
                                                />
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                                Product Info
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                                Seller
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                                Pricing
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading">
                                                Condition & Status
                                            </th>
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 font-heading text-right">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {pendingProducts.map((product) => (
                                            <tr key={product.id} className="group hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-5 align-top">
                                                    <input
                                                        className="mt-2 h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                                        type="checkbox"
                                                    />
                                                </td>
                                                <td className="px-6 py-5">
                                                    <div className="flex items-start gap-4">
                                                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark shadow-sm">
                                                            {product.images && product.images.length > 0 ? (
                                                                <Image
                                                                    alt={product.title}
                                                                    className="object-cover transition-transform group-hover:scale-105"
                                                                    src={product.images[0]}
                                                                    fill
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                                                    <Package className="w-8 h-8 text-slate-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col gap-1.5">
                                                            <span className="font-bold text-slate-900 dark:text-white text-base line-clamp-1">
                                                                {product.title}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                                    {product.category?.name || "Uncategorized"}
                                                                </span>
                                                                <span className="text-xs text-slate-400 font-mono">
                                                                    ID: {product.id.slice(0, 4)}
                                                                </span>
                                                            </div>
                                                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                                                Posted {timeAgo(product.created_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 align-top">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 font-bold text-xs">
                                                            {product.seller?.name?.slice(0, 2).toUpperCase() || "??"}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-slate-900 dark:text-white">
                                                                {product.seller?.store_name || product.seller?.name || "Unknown"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 align-top">
                                                    <span className="font-bold text-slate-900 dark:text-white font-heading text-lg">
                                                        {formatPrice(product.price)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 align-top">
                                                    <div className="flex flex-col gap-2 items-start">
                                                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${product.condition === "NEW" ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20" : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 ring-1 ring-inset ring-orange-600/20"}`}>
                                                            {product.condition === "NEW" ? "New Condition" : `Pre-loved ${product.condition_rating || ""}/10`}
                                                        </span>
                                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 dark:bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-700 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                                                            Pending Review
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-right align-top">
                                                    <ModerationActions productId={product.id} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination */}
                            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-surface-dark px-6 py-4">
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    Showing{" "}
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {pendingProducts.length}
                                    </span>{" "}
                                    items
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
