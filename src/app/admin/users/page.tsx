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
                                        User Management
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            User Management
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Manage user accounts, verify identities, and monitor trust scores.
                        </p>
                    </div>
                    <AddUserButton />
                </div>

                {/* Stats Cards */}
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Total Users */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Total Users
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.totalUsers.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10 text-brand-primary">
                                <Users className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="flex items-center rounded-full bg-green-50 dark:bg-green-500/10 px-2 py-0.5 text-xs font-bold text-green-600 dark:text-green-400">
                                <UserPlus className="w-3.5 h-3.5 mr-1" /> +{stats.newUsersThisWeek}
                            </span>
                            <span className="text-slate-400">this week</span>
                        </div>
                    </div>

                    {/* Active Sellers */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Active Sellers
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.totalSellers.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-500">
                                <Store className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">
                                {stats.totalUsers > 0 ? Math.round((stats.totalSellers / stats.totalUsers) * 100) : 0}% of total
                            </span>
                        </div>
                    </div>

                    {/* Published Products */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Live Products
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    {stats.publishedProducts.toLocaleString()}
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10 text-green-500">
                                <Package className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Available for sale</span>
                        </div>
                    </div>

                    {/* Verified Users (Placeholder stats for now) */}
                    <div className="group relative overflow-hidden rounded-2xl bg-white dark:bg-surface-dark p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                                    Verified
                                </p>
                                <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-white font-heading">
                                    98%
                                </p>
                            </div>
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10 text-purple-500">
                                <ShieldCheck className="w-6 h-6" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm">
                            <span className="text-slate-400">Trust score</span>
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
                                placeholder="Search by User ID, Name, or Email"
                                type="text"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <div className="relative">
                                <select className="appearance-none cursor-pointer rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all">
                                    <option>All Status</option>
                                    <option>Active</option>
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
                        <table className="w-full text-left text-sm text-slate-400">
                            <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    <th className="w-14 px-6 py-4">
                                        <input
                                            className="h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                            type="checkbox"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider font-heading">
                                        User
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider font-heading">
                                        Role
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider font-heading">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider font-heading">
                                        Joined
                                    </th>
                                    <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider font-heading text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-5 align-top">
                                            <input
                                                className="mt-2 h-5 w-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                                type="checkbox"
                                            />
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-10 w-10 flex-shrink-0">
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
                                                    <div className="font-medium text-slate-900 dark:text-white">
                                                        {user.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500">{user.email}</div>
                                                    <div className="text-[10px] text-brand-primary mt-0.5 font-mono">
                                                        ID: {user.id.slice(0, 8)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${user.role === "ADMIN" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"}`}>
                                                {user.role}
                                            </span>
                                            {user.store_name && (
                                                <div className="mt-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                                                    <Store className="w-3 h-3" />
                                                    <span className="font-medium truncate max-w-[100px]">{user.store_name}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${user.store_status === "BANNED" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400 ring-1 ring-inset ring-red-600/20" : "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400 ring-1 ring-inset ring-green-600/20"}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.store_status === "BANNED" ? "bg-red-600 animate-pulse" : "bg-green-600"}`}></span>
                                                {user.store_status || "Active"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 text-sm text-slate-500">
                                            <div>{formatDate(user.created_at)}</div>
                                            <div className="text-xs text-slate-400">{formatTime(user.created_at)}</div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <UserActions userId={user.id} isBanned={user.store_status === "BANNED"} />
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
