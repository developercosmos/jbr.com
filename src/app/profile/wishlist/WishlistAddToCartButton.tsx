"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShoppingCart } from "lucide-react";
import { addToCart } from "@/actions/cart";

interface Props {
    productId: string;
    productSlug: string;
}

export function WishlistAddToCartButton({ productId, productSlug }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [added, setAdded] = useState(false);

    const handleAdd = () => {
        startTransition(async () => {
            const result = await addToCart(productId, 1);

            if (!result.success) {
                if (result.error === "unauthorized") {
                    router.push("/auth/login?callbackUrl=%2Fprofile%2Fwishlist");
                    return;
                }

                if (result.error === "variant_required") {
                    router.push(`/product/${productSlug}`);
                    return;
                }

                if (result.error === "own_product") {
                    window.alert("Anda tidak dapat menambahkan produk sendiri ke keranjang.");
                    return;
                }

                if (result.error === "insufficient_stock") {
                    window.alert("Stok produk tidak mencukupi.");
                    return;
                }

                window.alert("Produk tidak dapat ditambahkan ke keranjang.");
                return;
            }

            setAdded(true);
            router.refresh();
            setTimeout(() => setAdded(false), 1500);
        });
    };

    return (
        <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="p-2 rounded-lg bg-brand-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20 disabled:opacity-60"
            aria-label="Tambah ke keranjang"
            title="Tambah ke keranjang"
        >
            {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : added ? (
                <Check className="w-4 h-4" />
            ) : (
                <ShoppingCart className="w-4 h-4" />
            )}
        </button>
    );
}
