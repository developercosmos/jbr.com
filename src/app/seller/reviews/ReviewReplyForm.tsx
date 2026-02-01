"use client";

import { useState, useTransition } from "react";
import { Reply, Loader2 } from "lucide-react";
import { replyToReview } from "@/actions/reviews";

interface ReviewReplyFormProps {
    reviewId: string;
}

export function ReviewReplyForm({ reviewId }: ReviewReplyFormProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [reply, setReply] = useState("");
    const [isPending, startTransition] = useTransition();
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (!reply.trim()) return;

        startTransition(async () => {
            try {
                await replyToReview(reviewId, reply.trim());
                setSubmitted(true);
                setIsOpen(false);
            } catch (error) {
                console.error("Error replying to review:", error);
            }
        });
    };

    if (submitted) {
        return (
            <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">✓ Balasan terkirim</p>
            </div>
        );
    }

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="mt-3 flex items-center gap-2 text-sm text-brand-primary hover:underline"
            >
                <Reply className="w-4 h-4" />
                Balas ulasan ini
            </button>
        );
    }

    return (
        <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Tulis balasan Anda..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                rows={3}
                disabled={isPending}
            />
            <div className="flex justify-end gap-2 mt-3">
                <button
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                    disabled={isPending}
                >
                    Batal
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!reply.trim() || isPending}
                    className="px-4 py-2 text-sm bg-brand-primary hover:bg-blue-600 text-white font-medium rounded-lg disabled:bg-slate-300 transition-colors flex items-center gap-2"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Mengirim...
                        </>
                    ) : (
                        "Kirim Balasan"
                    )}
                </button>
            </div>
        </div>
    );
}
