"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Trash2, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { approveProduct, rejectProduct, adminDeleteProduct } from "@/actions/admin";

interface ProductActionsProps {
    productId: string;
    productSlug: string;
    status: string;
}

export function ProductActions({ productId, productSlug, status }: ProductActionsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleApprove = async () => {
        setIsLoading("approve");
        try {
            await approveProduct(productId);
            router.refresh();
        } catch (error) {
            console.error("Failed to approve product:", error);
            alert("Gagal menyetujui produk");
        } finally {
            setIsLoading(null);
        }
    };

    const handleReject = async () => {
        setIsLoading("reject");
        try {
            await rejectProduct(productId);
            router.refresh();
        } catch (error) {
            console.error("Failed to reject product:", error);
            alert("Gagal menolak produk");
        } finally {
            setIsLoading(null);
        }
    };

    const handleDelete = async () => {
        setIsLoading("delete");
        try {
            await adminDeleteProduct(productId);
            router.refresh();
        } catch (error) {
            console.error("Failed to delete product:", error);
            alert("Gagal menghapus produk");
        } finally {
            setIsLoading(null);
            setShowDeleteConfirm(false);
        }
    };

    const isReviewStatus = status === "DRAFT";

    return (
        <div className="flex items-center justify-center gap-1">
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-surface-dark rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                            Hapus Produk?
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6">
                            Produk ini akan dihapus secara permanen dan tidak dapat dikembalikan.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium"
                                disabled={isLoading === "delete"}
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
                                disabled={isLoading === "delete"}
                            >
                                {isLoading === "delete" ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Menghapus...
                                    </>
                                ) : (
                                    "Hapus"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Button */}
            <Link
                href={`/product/${productSlug}`}
                className="p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                title="Lihat Detail"
            >
                <Eye className="w-4 h-4" />
            </Link>

            {/* Approve/Reject for Review status */}
            {isReviewStatus && (
                <>
                    <button
                        onClick={handleApprove}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Setujui"
                        disabled={isLoading !== null}
                    >
                        {isLoading === "approve" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                    </button>
                    <button
                        onClick={handleReject}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Tolak"
                        disabled={isLoading !== null}
                    >
                        {isLoading === "reject" ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <XCircle className="w-4 h-4" />
                        )}
                    </button>
                </>
            )}

            {/* Delete Button */}
            <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                title="Hapus"
                disabled={isLoading !== null}
            >
                <Trash2 className="w-4 h-4" />
            </button>
        </div>
    );
}
