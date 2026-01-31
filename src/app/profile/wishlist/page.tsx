import { Heart, ShoppingCart, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getWishlist } from "@/actions/wishlist";
import { WishlistItemActions } from "./WishlistItemActions";

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

export default async function WishlistPage() {
    const wishlistItems = await getWishlist();

    return (
        <div className="flex-1">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase mb-2">
                    Wishlist
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Barang impian yang Anda simpan.
                </p>
            </div>

            {wishlistItems.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                    <Heart className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        Wishlist kosong
                    </h3>
                    <p className="text-slate-500 mb-6">
                        Simpan produk favorit Anda untuk dibeli nanti.
                    </p>
                    <Link
                        href="/"
                        className="inline-block px-6 py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
                    >
                        Jelajahi Produk
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {wishlistItems.map((item) => (
                        <div key={item.id} className="group bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-all">
                            <div className="relative aspect-square bg-slate-100 dark:bg-slate-800">
                                {item.product.images && item.product.images.length > 0 ? (
                                    <Image
                                        src={item.product.images[0]}
                                        alt={item.product.title}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <ShoppingCart className="w-12 h-12 text-slate-400" />
                                    </div>
                                )}
                                <WishlistItemActions productId={item.product.id} />
                            </div>
                            <div className="p-4">
                                <Link href={`/product/${item.product.slug}`}>
                                    <h3 className="font-bold text-slate-900 dark:text-white mb-1 truncate group-hover:text-brand-primary transition-colors">
                                        {item.product.title}
                                    </h3>
                                </Link>
                                <p className="text-sm text-slate-500 mb-3">
                                    {item.product.category?.name || "Raket"}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-lg text-slate-900 dark:text-white">
                                        {formatPrice(item.product.price)}
                                    </span>
                                    <WishlistAddToCart productId={item.product.id} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Client Component for Add to Cart button
function WishlistAddToCart({ productId }: { productId: string }) {
    return (
        <form action={async () => {
            "use server";
            const { addToCart } = await import("@/actions/cart");
            await addToCart(productId);
        }}>
            <button
                type="submit"
                className="p-2 rounded-lg bg-brand-primary text-white hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20"
            >
                <ShoppingCart className="w-4 h-4" />
            </button>
        </form>
    );
}
