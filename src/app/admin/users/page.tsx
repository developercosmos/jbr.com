import Link from "next/link";
import Image from "next/image";
import { Users, UserPlus, ShieldCheck, Store, Search, ChevronDown, Package } from "lucide-react";
import { getAdminUsers, getAdminDashboardStats } from "@/actions/admin";
import { UserActions } from "./UserActions";
import { AddUserButton } from "./AddUserButton";
import { ExportUsersButton } from "./ExportUsersButton";

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(date);
}

function formatTime(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

export default async function UserManagementPage() {
    const [stats, users] = await Promise.all([
        getAdminDashboardStats(),
        getAdminUsers(),
    ]);

    const pendingStoreReviews = users.filter((u) => u.store_status === "PENDING_REVIEW").length;
    const bannedUsers = users.filter((u) => u.store_status === "BANNED").length;
    const activeUsers = users.filter((u) => u.store_status === "ACTIVE").length;

    return (
        <>
            <div className="container mx-auto max-w-[1500px] p-4 lg:p-6 flex flex-col gap-5 relative z-0">
                {/* Header */}
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="space-y-1">
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
                                        User Management
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            User Management
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Monitor akun, review seller baru, dan lakukan aksi admin lebih cepat.
                        </p>
                    </div>
                    <AddUserButton />
                </div>

                {/* Stats Cards */}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Total Users
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {stats.totalUsers.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-brand-primary">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 font-bold text-green-600 dark:text-green-400">
                                <UserPlus className="w-3.5 h-3.5 mr-1" /> +{stats.newUsersThisWeek}
                            </span>
                            <span className="text-slate-400">this week</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Active Sellers
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {stats.totalSellers.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-500">
                                <Store className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-400">
                                {stats.totalUsers > 0 ? Math.round((stats.totalSellers / stats.totalUsers) * 100) : 0}% of total
                            </span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Live Products
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {stats.publishedProducts.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-500/10 text-green-500">
                                <Package className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Available for sale</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Pending Review
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {pendingStoreReviews}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-500">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Store activation queue</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Active Users
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {activeUsers}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Ready to transact</span>
                        </div>
                    </div>

                    <div className="rounded-xl bg-white dark:bg-surface-dark p-4 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Banned
                                </p>
                                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white font-heading leading-none">
                                    {bannedUsers}
                                </p>
                            </div>
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-500">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Restricted accounts</span>
                        </div>
                    </div>
                </div>

                {/* Filters & Table */}
                <div className="flex flex-col rounded-2xl bg-white dark:bg-surface-dark shadow-sm overflow-hidden border border-slate-100 dark:border-slate-800">
                    {/* Filters */}
                    <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-surface-dark">
                        <div className="relative w-full md:max-w-md group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                                <Search className="w-5 h-5" />
                            </span>
                            <input
                                className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-primary focus:ring-brand-primary transition-shadow"
                                placeholder="Search by User ID, Name, or Email"
                                type="text"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <div className="relative">
                                <select className="appearance-none cursor-pointer rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all">
                                    <option>All Status</option>
                                    <option>Active</option>
                                    <option>Pending</option>
                                    <option>Banned</option>
                                </select>
                                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                    <ChevronDown className="w-5 h-5" />
                                </div>
                            </div>
                            <ExportUsersButton users={users} />
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-500">
                            <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="w-12 px-4 py-3">
                                        <input
                                            className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                            type="checkbox"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">
                                        User
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">
                                        Role
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">
                                        Joined
                                    </th>
                                    <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-4 py-3 align-top">
                                            <input
                                                className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                                type="checkbox"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-9 w-9 flex-shrink-0">
                                                    {user.image ? (
                                                        <Image
                                                            alt={user.name}
                                                            className="rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                                            src={user.image}
                                                            fill
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                            <span className="font-bold text-slate-400 text-xs">
                                                                {user.name?.slice(0, 2).toUpperCase() || "??"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900 dark:text-white leading-tight">
                                                        {user.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 leading-tight">{user.email}</div>
                                                    <div className="text-[10px] text-brand-primary mt-0.5 font-mono leading-tight">
                                                        ID: {user.id.slice(0, 8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${user.role === "ADMIN" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                                                {user.role}
                                            </span>
                                            {user.store_name && (
                                                <div className="mt-1 flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
                                                    <Store className="w-3 h-3" />
                                                    <span className="font-medium truncate max-w-[130px]">{user.store_name}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {!user.email_verified ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 ring-1 ring-inset ring-yellow-600/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 animate-pulse"></span>
                                                    PENDING
                                                </span>
                                            ) : user.store_status === "BANNED" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 ring-1 ring-inset ring-red-600/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                                                    BANNED
                                                </span>
                                            ) : user.store_status === "PENDING_REVIEW" ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400 ring-1 ring-inset ring-orange-600/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                                                    PENDING REVIEW
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 ring-1 ring-inset ring-green-600/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                                    ACTIVE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-500">
                                            <div>{formatDate(user.created_at)}</div>
                                            <div className="text-[11px] text-slate-400">{formatTime(user.created_at)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <UserActions
                                                user={{
                                                    id: user.id,
                                                    name: user.name,
                                                    email: user.email,
                                                    role: user.role,
                                                    storeStatus: user.store_status,
                                                    storeName: user.store_name,
                                                    storeSlug: user.store_slug,
                                                    storeDescription: user.store_description,
                                                    payoutBankName: user.payout_bank_name,
                                                }}
                                                isBanned={user.store_status === "BANNED"}
                                                isPendingVerification={!user.email_verified}
                                                isPendingStoreReview={user.store_status === "PENDING_REVIEW"}
                                                canViewStoreDetail={Boolean(user.store_name || user.store_slug || user.store_description || user.payout_bank_name)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
}
