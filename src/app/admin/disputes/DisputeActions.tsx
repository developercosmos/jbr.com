"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, CheckCircle, XCircle, Loader2, MessageSquare } from "lucide-react";
import { updateDisputeStatus } from "@/actions/admin";

interface DisputeActionsProps {
    disputeId: string;
    status: string;
}

export function DisputeActions({ disputeId, status }: DisputeActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [resolution, setResolution] = useState("");
    const [actionType, setActionType] = useState<string | null>(null);
    const [refund, setRefund] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === "RESOLVED" || newStatus === "CLOSED") {
            setActionType(newStatus);
            setError(null);
            setShowResolveModal(true);
            return;
        }

        setError(null);
        startTransition(async () => {
            try {
                // updateDisputeStatus RETURNS { success:false, error } on failure (no throw).
                const res = await updateDisputeStatus(disputeId, newStatus);
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal memperbarui sengketa.");
                    return;
                }
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal memperbarui sengketa.");
            }
        });
    };

    const handleResolve = () => {
        setError(null);
        startTransition(async () => {
            try {
                // On failure (incl. refund errors) the action returns { success:false }
                // rather than throwing — must NOT close the modal or refresh.
                const res = await updateDisputeStatus(disputeId, actionType!, resolution, { refund });
                if (res && "success" in res && res.success === false) {
                    setError(res.error || "Gagal menyelesaikan kasus.");
                    return;
                }
                setShowResolveModal(false);
                setResolution("");
                setRefund(false);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyelesaikan kasus.");
            }
        });
    };

    const isOpen = status === "OPEN";
    const isInProgress = status === "IN_PROGRESS";
    const isResolved = status === "RESOLVED" || status === "CLOSED";

    return (
        <>
            <div className="flex flex-col gap-2">
                {isOpen && (
                    <button
                        onClick={() => handleStatusChange("IN_PROGRESS")}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <MessageSquare className="w-4 h-4" />
                        )}
                        Proses Kasus
                    </button>
                )}

                {isInProgress && (
                    <>
                        <button
                            onClick={() => handleStatusChange("RESOLVED")}
                            disabled={isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <CheckCircle className="w-4 h-4" />
                            )}
                            Selesaikan
                        </button>
                        <button
                            onClick={() => handleStatusChange("CLOSED")}
                            disabled={isPending}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white text-sm font-bold rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            <XCircle className="w-4 h-4" />
                            Tutup Kasus
                        </button>
                    </>
                )}

                {isResolved && (
                    <span className="text-center text-sm font-medium text-slate-500">
                        Kasus telah diselesaikan
                    </span>
                )}

                {error && !showResolveModal && (
                    <p className="text-xs text-rose-600 dark:text-rose-400 text-center">{error}</p>
                )}
            </div>

            {/* Resolution Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                            {actionType === "RESOLVED" ? "Selesaikan Kasus" : "Tutup Kasus"}
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">
                            Tambahkan catatan resolusi untuk kasus ini:
                        </p>
                        <textarea
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            placeholder="Catatan resolusi..."
                            className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-4 bg-white dark:bg-slate-800"
                            rows={4}
                        />
                        <label className="flex items-start gap-2 mb-4 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={refund}
                                onChange={(e) => setRefund(e.target.checked)}
                                className="mt-0.5"
                            />
                            <span>
                                Kembalikan dana ke pembeli (refund). Stok dikembalikan, escrow & jurnal
                                dibalik, dan komisi afiliasi dibatalkan. Lakukan transfer dana manual/Xendit terpisah.
                            </span>
                        </label>
                        {error && (
                            <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">{error}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowResolveModal(false);
                                    setResolution("");
                                    setError(null);
                                }}
                                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-medium"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={isPending}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
                            >
                                {isPending ? "Memproses..." : "Konfirmasi"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
