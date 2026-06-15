"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, ChevronDown, Store } from "lucide-react";
import type { getAdminUsers } from "@/actions/admin";
import { UserActions } from "./UserActions";
import { ExportUsersButton } from "./ExportUsersButton";

type UserRow = Awaited<ReturnType<typeof getAdminUsers>>[number];

const STATUS_OPTIONS = ["All Status", "Active", "Pending", "Banned"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
function formatTime(date: Date) {
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
}

/** Mirror the badge logic below so the filter and the displayed status agree. */
function displayStatus(u: UserRow): "ACTIVE" | "PENDING" | "BANNED" {
    if (u.store_status === "BANNED") return "BANNED";
    if (!u.email_verified || u.store_status === "PENDING_REVIEW") return "PENDING";
    return "ACTIVE";
}

export function UsersTableClient({ users }: { users: UserRow[] }) {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState<StatusOption>("All Status");

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            if (status !== "All Status") {
                const ds = displayStatus(u);
                if (status === "Active" && ds !== "ACTIVE") return false;
                if (status === "Pending" && ds !== "PENDING") return false;
                if (status === "Banned" && ds !== "BANNED") return false;
            }
            if (q) {
                const hay = `${u.name ?? ""} ${u.email ?? ""} ${u.id} ${u.store_name ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [users, query, status]);

    return (
        <>
            {/* Filters */}
            <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3 flex flex-col md:flex-row gap-3 items-center justify-between bg-white dark:bg-surface-dark">
                <div className="relative w-full md:max-w-md group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors">
                        <Search className="w-5 h-5" />
                    </span>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full rounded-lg border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-brand-primary focus:ring-brand-primary transition-shadow"
                        placeholder="Search by User ID, Name, or Email"
                        type="text"
                    />
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                    <span className="text-xs text-slate-400 hidden md:inline">
                        {filtered.length} dari {users.length}
                    </span>
                    <div className="relative">
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as StatusOption)}
                            className="appearance-none cursor-pointer rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-brand-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                            <ChevronDown className="w-5 h-5" />
                        </div>
                    </div>
                    <ExportUsersButton users={filtered} />
                </div>
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-500">
                    <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                        <tr>
                            <th className="w-12 px-4 py-3">
                                <input className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" type="checkbox" />
                            </th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">User</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">Role</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">Status</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading">Joined</th>
                            <th className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider font-heading text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                                    Tidak ada user yang cocok dengan filter ini.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((user) => (
                                <tr key={user.id} className="hover:bg-blue-50/50 dark:hover:bg-white/5 transition-colors group">
                                    <td className="px-4 py-3 align-top">
                                        <input className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" type="checkbox" />
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-9 w-9 flex-shrink-0">
                                                {user.image ? (
                                                    <Image alt={user.name} className="rounded-full object-cover border border-slate-200 dark:border-slate-700" src={user.image} fill />
                                                ) : (
                                                    <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                                        <span className="font-bold text-slate-400 text-xs">{user.name?.slice(0, 2).toUpperCase() || "??"}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-slate-900 dark:text-white leading-tight">{user.name}</div>
                                                <div className="text-xs text-slate-500 leading-tight">{user.email}</div>
                                                <div className="text-[10px] text-brand-primary mt-0.5 font-mono leading-tight">ID: {user.id.slice(0, 8)}</div>
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
                                                <a href={`/admin/kyc?seller=${encodeURIComponent(user.id)}`} className="ml-1 text-brand-primary hover:underline font-semibold" title="Lihat pengajuan & dokumen KYC seller ini (status apa pun)">KYC</a>
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
                                                storeReviewNotes: user.store_review_notes,
                                            }}
                                            isBanned={user.store_status === "BANNED"}
                                            isPendingVerification={!user.email_verified}
                                            isPendingStoreReview={user.store_status === "PENDING_REVIEW"}
                                            canViewStoreDetail={Boolean(user.store_name || user.store_slug || user.store_description || user.payout_bank_name || user.store_review_notes)}
                                        />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
