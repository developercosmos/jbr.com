"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { ReviewModal } from "@/components/reviews/ReviewModal";

interface Props {
    orderItemId: string;
    productName: string;
    productImage?: string;
    alreadyReviewed: boolean;
}

// Shown on a delivered/completed order item so the buyer can write a product
// review. Eligibility (ownership + delivered + not-yet-reviewed) is enforced
// server-side by createReview; this just gates the entry point.
export default function OrderItemReviewButton({
    orderItemId,
    productName,
    productImage,
    alreadyReviewed,
}: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);

    if (alreadyReviewed) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                Sudah diulas
            </span>
        );
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
                <Star className="w-3.5 h-3.5" />
                Beri Ulasan
            </button>
            <ReviewModal
                isOpen={open}
                onClose={() => setOpen(false)}
                orderItemId={orderItemId}
                productName={productName}
                productImage={productImage}
                onSuccess={() => router.refresh()}
            />
        </>
    );
}
