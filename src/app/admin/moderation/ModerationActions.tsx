"use client";

import { CheckCircle, Ban, MoreHorizontal } from "lucide-react";
import { useTransition } from "react";
import { approveProduct, rejectProduct } from "@/actions/admin";

export function ModerationActions({ productId }: { productId: string }) {
    const [isPending, startTransition] = useTransition();

    const handleApprove = () => {
        startTransition(async () => {
            await approveProduct(productId);
        });
    };

    const handleReject = () => {
        startTransition(async () => {
            await rejectProduct(productId);
        });
    };

    return (
        <div className="flex items-center justify-end gap-2">
            <button
                onClick={handleReject}
                disabled={isPending}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-50"
                title="Reject"
            >
                <Ban className="w-5 h-5" />
            </button>
            <button
                onClick={handleApprove}
                disabled={isPending}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white hover:shadow-lg hover:shadow-brand-primary/20 transition-all disabled:opacity-50"
                title="Approve"
            >
                <CheckCircle className="w-5 h-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-white transition-colors">
                <MoreHorizontal className="w-5 h-5" />
            </button>
        </div>
    );
}
