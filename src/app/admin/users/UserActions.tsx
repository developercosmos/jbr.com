"use client";

import { Ban, RefreshCcw, Trash2, Mail, Loader2, Eye, ExternalLink, Store, UserCircle2, Landmark } from "lucide-react";
import { useState, useTransition } from "react";
import { banUser, unbanUser, deleteUser, approveSellerActivation, rejectSellerActivation } from "@/actions/admin";
import { requestEmailVerification } from "@/actions/auth-email";
import { EditUserButton } from "./EditUserButton";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface UserData {
    id: string;
    name: string | null;
    email: string;
    role: "USER" | "ADMIN";
    storeStatus?: "ACTIVE" | "PENDING_REVIEW" | "VACATION" | "BANNED" | null;
    storeName?: string | null;
    storeSlug?: string | null;
    storeDescription?: string | null;
    payoutBankName?: string | null;
    storeReviewNotes?: string | null;
}

export function UserActions({ user, isBanned, isPendingVerification, isPendingStoreReview, canViewStoreDetail }: { user: UserData; isBanned: boolean; isPendingVerification: boolean; isPendingStoreReview: boolean; canViewStoreDetail: boolean }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showStoreDetail, setShowStoreDetail] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [reviewFeedback, setReviewFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
    const [sellerReviewNotes, setSellerReviewNotes] = useState(user.storeReviewNotes ?? "");

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
            setReviewFeedback(null);
            try {
                const result = await approveSellerActivation(user.id);
                setReviewFeedback({ type: "success", message: result.message || "Approve berhasil." });
                setTimeout(() => {
                    setShowStoreDetail(false);
                    router.refresh();
                }, 700);
            } catch (error: any) {
                setReviewFeedback({ type: "error", message: error?.message || "Approve gagal. Silakan coba lagi." });
            }
        });
    };

    const handleRejectSeller = () => {
        startTransition(async () => {
            setReviewFeedback(null);
            if (!sellerReviewNotes.trim()) {
                setReviewFeedback({ type: "error", message: "Alasan reject wajib diisi." });
                return;
            }
            try {
                const result = await rejectSellerActivation(user.id, sellerReviewNotes);
                setReviewFeedback({ type: "success", message: result.message || "Reject berhasil." });
                setTimeout(() => {
                    setShowStoreDetail(false);
                    router.refresh();
                }, 700);
            } catch (error: any) {
                setReviewFeedback({ type: "error", message: error?.message || "Reject gagal. Silakan coba lagi." });
            }
        });
    };

    return (
        <>
            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                <EditUserButton user={user} />
                {canViewStoreDetail && (
                    <>
                        <button
                            onClick={() => setShowStoreDetail(true)}
                            disabled={isPending}
                            className="p-2 rounded-lg text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 hover:text-sky-600 dark:hover:text-sky-400 transition-colors disabled:opacity-50"
                            title="Detail Store"
                        >
                            <Eye className="w-4 h-4" />
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
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full mx-4 shadow-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="px-5 py-4 bg-gradient-to-r from-brand-primary/10 to-sky-500/10 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-heading font-bold text-slate-900 dark:text-white uppercase">
                                Detail Pengajuan Seller
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Review profil toko sebelum memutuskan approve atau reject.
                            </p>
                        </div>

                        <div className="p-5 space-y-4">
                            {reviewFeedback && (
                                <div
                                    className={`rounded-lg border px-3 py-2 text-sm ${reviewFeedback.type === "success"
                                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                            : "border-rose-300 bg-rose-50 text-rose-800"
                                        }`}
                                >
                                    {reviewFeedback.message}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/30 p-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                                        <UserCircle2 className="w-3.5 h-3.5" /> Pemohon
                                    </div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{user.name || "-"}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</div>
                                </div>

                                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/30 p-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                                        <Store className="w-3.5 h-3.5" /> Store
                                    </div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{user.storeName || "-"}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">/{user.storeSlug || "-"}</div>
                                </div>
                            </div>

                            {user.storeReviewNotes && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                    <div className="font-semibold mb-1">Catatan review terakhir</div>
                                    <div>{user.storeReviewNotes}</div>
                                </div>
                            )}

                            {isPendingStoreReview && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        Alasan reject / catatan revisi
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={sellerReviewNotes}
                                        onChange={(e) => setSellerReviewNotes(e.target.value)}
                                        placeholder="Jelaskan data apa yang perlu diperbaiki atau dilengkapi seller."
                                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white"
                                    />
                                </div>
                            )}

                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5">
                                    <Landmark className="w-3.5 h-3.5" /> Payout Bank
                                </div>
                                <div className="text-sm text-slate-700 dark:text-slate-300">
                                    {user.payoutBankName || "-"}
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                    Deskripsi Toko
                                </div>
                                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                                    {user.storeDescription || "-"}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                                    Status Saat Ini
                                </div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                    {user.storeStatus || "-"}
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
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

                                <div className="flex items-center gap-2">
                                    {isPendingStoreReview && (
                                        <>
                                            <button
                                                onClick={handleRejectSeller}
                                                disabled={isPending}
                                                className="px-3.5 py-2 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-800/60 dark:text-orange-300 dark:hover:bg-orange-900/20 text-sm font-semibold disabled:opacity-50"
                                            >
                                                {isPending ? "Menyimpan..." : "Reject"}
                                            </button>
                                            <button
                                                onClick={handleApproveSeller}
                                                disabled={isPending}
                                                className="px-3.5 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                                            >
                                                {isPending ? "Menyimpan..." : "Approve"}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setShowStoreDetail(false)}
                                        className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium"
                                    >
                                        Tutup
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
