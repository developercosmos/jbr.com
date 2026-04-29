"use client";

import { Ban, RefreshCcw, Trash2, Mail, Loader2, Check, X, Eye, ExternalLink } from "lucide-react";
import { useState, useTransition } from "react";
import { banUser, unbanUser, deleteUser, approveSellerActivation, rejectSellerActivation } from "@/actions/admin";
import { requestEmailVerification } from "@/actions/auth-email";
import { EditUserButton } from "./EditUserButton";
import Link from "next/link";

interface UserData {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
    storeName?: string | null;
    storeSlug?: string | null;
    storeDescription?: string | null;
    payoutBankName?: string | null;
}

export function UserActions({ user, isBanned, isPendingVerification, isPendingStoreReview }: { user: UserData; isBanned: boolean; isPendingVerification: boolean; isPendingStoreReview: boolean }) {
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStoreDetail, setShowStoreDetail] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);

    const handleBan = () => {
        startTransition(async () => {
            await banUser(user.id);
        });
    };

    const handleUnban = () => {
        startTransition(async () => {
            await unbanUser(user.id);
        });
    };

    const handleResendVerification = () => {
        startTransition(async () => {
            const result = await requestEmailVerification(user.id);
            if (result.success) {
                setResendSuccess(true);
                setTimeout(() => setResendSuccess(false), 3000);
            }
        });
    };

    const handleDelete = () => {
        startTransition(async () => {
            try {
                await deleteUser(user.id);
            } catch (error: any) {
                alert(error.message || "Gagal menghapus user");
            }
            setShowDeleteConfirm(false);
        });
    };

    const handleApproveSeller = () => {
        startTransition(async () => {
            await approveSellerActivation(user.id);
        });
    };

    const handleRejectSeller = () => {
        startTransition(async () => {
            await rejectSellerActivation(user.id);
        });
    };

    return (
        <>
            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <EditUserButton user={user} />
                {isPendingStoreReview && (
                    <>
                        <button
                            onClick={() => setShowStoreDetail(true)}
                            disabled={isPending}
                            className="p-2 rounded-lg text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-50"
                            title="Detail Store"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleApproveSeller}
                            disabled={isPending}
                            className="p-2 rounded-lg text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                            title="Approve Seller Activation"
                        >
                            <Check className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRejectSeller}
                            disabled={isPending}
                            className="p-2 rounded-lg text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-50"
                            title="Reject Seller Activation"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </>
                )}
                {isPendingVerification && (
                    <button
                        onClick={handleResendVerification}
                        disabled={isPending || resendSuccess}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${resendSuccess
                                ? "text-green-600 bg-green-50 dark:bg-green-900/20"
                                : "text-slate-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 hover:text-yellow-600 dark:hover:text-yellow-400"
                            }`}
                        title={resendSuccess ? "Email Terkirim!" : "Resend Verification Email"}
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : resendSuccess ? (
                            <Mail className="w-4 h-4" />
                        ) : (
                            <Mail className="w-4 h-4" />
                        )}
                    </button>
                )}
                {isBanned ? (
                    <button
                        onClick={handleUnban}
                        disabled={isPending}
                        className="p-2 rounded-lg text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50"
                        title="Unban User"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={handleBan}
                        disabled={isPending}
                        className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Ban User"
                    >
                        <Ban className="w-4 h-4" />
                    </button>
                )}
                <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isPending}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                    title="Delete User"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Hapus User?
                        </h3>
                        <p className="text-slate-500 mb-4">
                            Apakah Anda yakin ingin menghapus <strong>{user.name || user.email}</strong>?
                            Tindakan ini tidak dapat dibatalkan.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                                {isPending ? "Menghapus..." : "Hapus User"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showStoreDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                            Detail Pengajuan Seller
                        </h3>
                        <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Nama:</span> {user.name || "-"}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Email:</span> {user.email}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Store:</span> {user.storeName || "-"}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Slug:</span> {user.storeSlug || "-"}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Payout Bank:</span> {user.payoutBankName || "-"}
                            </div>
                            <div>
                                <span className="font-semibold text-slate-900 dark:text-white">Deskripsi:</span> {user.storeDescription || "-"}
                            </div>
                        </div>
                        <div className="mt-5 flex items-center justify-between gap-3">
                            {user.storeSlug ? (
                                <Link
                                    href={`/store/${user.storeSlug}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-sm font-semibold text-brand-primary hover:underline"
                                >
                                    Buka halaman store <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                            ) : (
                                <span className="text-sm text-slate-400">Store belum punya slug</span>
                            )}
                            <button
                                onClick={() => setShowStoreDetail(false)}
                                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
