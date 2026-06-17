"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { addToWishlist, removeFromWishlist, isInWishlist } from "@/actions/wishlist";

interface Props {
    productId: string;
    isAuthenticated: boolean;
    /** Pass the known state for lists (avoids an on-mount fetch per card). */
    initialWishlisted?: boolean;
    variant?: "full" | "icon";
    className?: string;
}

/**
 * Persistent wishlist toggle. Loads the real state (prop for lists, else a one-
 * shot fetch), toggles add/remove with an optimistic update, and reverts on
 * error. Replaces the old PDP button (which never loaded state and self-reset
 * after 2s) and the dead heart on product cards.
 */
export function WishlistButton({
    productId,
    isAuthenticated,
    initialWishlisted,
    variant = "full",
    className = "",
}: Props) {
    const router = useRouter();
    const [wishlisted, setWishlisted] = useState(initialWishlisted ?? false);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (initialWishlisted !== undefined) {
            setWishlisted(initialWishlisted);
            return;
        }
        if (!isAuthenticated) return;
        let alive = true;
        isInWishlist(productId)
            .then((v) => {
                if (alive) setWishlisted(v);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [productId, isAuthenticated, initialWishlisted]);

    function toggle(e: React.MouseEvent) {
        // The button can sit inside a product-card <Link>; never navigate.
        e.preventDefault();
        e.stopPropagation();
        if (!isAuthenticated) {
            router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
            return;
        }
        const next = !wishlisted;
        setWishlisted(next); // optimistic
        startTransition(async () => {
            try {
                const res = next ? await addToWishlist(productId) : await removeFromWishlist(productId);
                if (res && "success" in res && res.success === false) {
                    setWishlisted(!next); // revert
                    if (res.error === "own_product") {
                        alert("Anda tidak dapat menambahkan produk sendiri ke wishlist");
                    } else if (res.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                    }
                }
            } catch {
                setWishlisted(!next); // revert
            }
        });
    }

    if (variant === "icon") {
        return (
            <button
                type="button"
                onClick={toggle}
                disabled={pending}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? "Hapus dari wishlist" : "Tambah ke wishlist"}
                className={
                    className ||
                    "absolute top-3 right-3 p-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors z-10"
                }
            >
                {pending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500 text-red-500" : ""}`} />
                )}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={toggle}
            disabled={pending}
            aria-pressed={wishlisted}
            className={
                className ||
                "flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-red-500 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
            }
        >
            {pending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
                <Heart className={`w-4 h-4 ${wishlisted ? "fill-red-500 text-red-500" : ""}`} />
            )}
            {wishlisted ? "Di Wishlist" : "Add to Wishlist"}
        </button>
    );
}
