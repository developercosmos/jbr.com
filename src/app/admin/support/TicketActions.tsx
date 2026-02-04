"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, XCircle, Loader2, Send } from "lucide-react";
import { updateTicketStatus, replyToTicket } from "@/actions/admin";

interface TicketActionsProps {
    ticketId: string;
    status: string;
}

export function TicketActions({ ticketId, status }: TicketActionsProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyMessage, setReplyMessage] = useState("");

    const handleStatusChange = (newStatus: string) => {
        startTransition(async () => {
            await updateTicketStatus(ticketId, newStatus);
            router.refresh();
        });
    };

    const handleReply = () => {
        if (!replyMessage.trim()) return;

        startTransition(async () => {
            await replyToTicket(ticketId, replyMessage);
            setShowReplyModal(false);
            setReplyMessage("");
            router.refresh();
        });
    };

    const isOpen = status === "OPEN";
    const isPending_ = status === "PENDING";
    const isInProgress = status === "IN_PROGRESS";
    const isClosed = status === "CLOSED";

    return (
        <>
            <div className="flex flex-col gap-2">
                {!isClosed && (
                    <button
                        onClick={() => setShowReplyModal(true)}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                        Balas
                    </button>
                )}

                {(isOpen || isPending_ || isInProgress) && (
                    <button
                        onClick={() => handleStatusChange("CLOSED")}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <CheckCircle className="w-4 h-4" />
                        )}
                        Tutup Tiket
                    </button>
                )}

                {isClosed && (
                    <button
                        onClick={() => handleStatusChange("OPEN")}
                        disabled={isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-lg hover:bg-yellow-200 transition-colors disabled:opacity-50"
                    >
                        <Clock className="w-4 h-4" />
                        Buka Kembali
                    </button>
                )}
            </div>

            {/* Reply Modal */}
            {showReplyModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white dark:bg-surface-dark rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                            Balas Tiket
                        </h3>
                        <textarea
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Ketik balasan..."
                            className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mb-4 bg-white dark:bg-slate-800 min-h-[120px]"
                            rows={4}
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setShowReplyModal(false);
                                    setReplyMessage("");
                                }}
                                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-medium"
                            >
                                Batal
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={isPending || !replyMessage.trim()}
                                className="flex-1 px-4 py-2 bg-brand-primary text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Kirim
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
