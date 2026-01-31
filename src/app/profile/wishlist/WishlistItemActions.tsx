"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { removeFromWishlist } from "@/actions/wishlist";

export function WishlistItemActions({ productId }: { productId: string }) {
    const [isPending, startTransition] = useTransition();

    const handleRemove = () => {
        startTransition(async () => {
            await removeFromWishlist(productId);
        });
    };

    return (
        <button
            onClick={handleRemove}
            disabled={isPending}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/80 dark:bg-black/50 text-red-500 hover:bg-white dark:hover:bg-black/70 transition-colors disabled:opacity-50"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    );
}
