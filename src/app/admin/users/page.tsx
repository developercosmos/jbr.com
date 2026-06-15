import Link from "next/link";
import { Users, UserPlus, ShieldCheck, Store, Package } from "lucide-react";
import { getAdminUsers, getAdminDashboardStats } from "@/actions/admin";
import { AddUserButton } from "./AddUserButton";
import { UsersTableClient } from "./UsersTableClient";

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
                    <UsersTableClient users={users} />
                </div>
            </div>
        </>
    );
}
