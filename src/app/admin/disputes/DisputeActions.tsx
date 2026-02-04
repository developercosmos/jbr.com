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

    const handleStatusChange = (newStatus: string) => {
        if (newStatus === "RESOLVED" || newStatus === "CLOSED") {
            setActionType(newStatus);
            setShowResolveModal(true);
            return;
        }

        startTransition(async () => {
            await updateDisputeStatus(disputeId, newStatus);
            router.refresh();
        });
    };

    const handleResolve = () => {
        startTransition(async () => {
            await updateDisputeStatus(disputeId, actionType!, resolution);
            setShowResolveModal(false);
            setResolution("");
            router.refresh();
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
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowResolveModal(false);
                                    setResolution("");
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
