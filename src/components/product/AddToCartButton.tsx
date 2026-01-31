"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Loader2, Check } from "lucide-react";
import { addToCart } from "@/actions/cart";

interface AddToCartButtonProps {
    productId: string;
    className?: string;
}

export function AddToCartButton({ productId, className = "" }: AddToCartButtonProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [added, setAdded] = useState(false);
    const [error, setError] = useState("");

    const handleAddToCart = () => {
        setError("");
        setAdded(false);

        startTransition(async () => {
            try {
                await addToCart(productId, 1);
                setAdded(true);
                router.refresh();

                // Reset after 2 seconds
                setTimeout(() => setAdded(false), 2000);
            } catch (err) {
                if (err instanceof Error) {
                    if (err.message === "Unauthorized") {
                        router.push("/auth/login?redirect=/product");
                    } else {
                        setError(err.message);
                    }
                } else {
                    setError("Gagal menambahkan ke keranjang");
                }
            }
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleAddToCart}
                disabled={isPending || added}
                className={`flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-70 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] ${className}`}
            >
                {isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : added ? (
                    <>
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="text-green-600">Ditambahkan!</span>
                    </>
                ) : (
                    <>
                        <ShoppingCart className="w-5 h-5" />
                        Tambah ke Keranjang
                    </>
                )}
            </button>
            {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
            )}
        </div>
    );
}
