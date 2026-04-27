"use client";

import { ShieldCheck, Truck, Heart, Share2, ShoppingCart, Loader2, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/actions/cart";
import { startConversation } from "@/actions/chat";
import { addToWishlist } from "@/actions/wishlist";
import { VariantSelector } from "@/components/product/VariantSelector";
import MakeOfferButton from "@/components/product/MakeOfferButton";

interface ProductSeller {
    id: string;
    name: string;
    store_name: string | null;
    store_slug: string | null;
    store_description: string | null;
    image: string | null;
}

interface ProductCategory {
    id: string;
    name: string;
    slug: string;
}

interface ProductInfoProps {
    product: {
        id: string;
        title: string;
        description: string | null;
        price: string;
        condition: "NEW" | "PRELOVED";
        condition_rating: number | null;
        condition_notes: string | null;
        stock: number;
        seller: ProductSeller | null;
        category: ProductCategory | null;
        bargain_enabled?: boolean;
        auto_decline_below?: string | null;
        variants: {
            id: string;
            name: string;
            variant_type: string;
            price: string | null;
            stock: number;
            images: string[] | null;
            is_available: boolean;
        }[];
    };
    sellerReputation?: {
        avgRating: number;
        ratingCount: number;
        completionRate: number;
        cancellationRate: number;
        responseTimeMinutes: number;
    } | null;
}

function formatResponseTime(minutes: number): string {
    if (!minutes || minutes <= 0) return "-";
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} jam`;
    return `${Math.round(hours / 24)} hari`;
}

export function ProductInfo({ product, sellerReputation }: ProductInfoProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isChatPending, startChatTransition] = useTransition();
    const [isWishlistPending, startWishlistTransition] = useTransition();
    const [added, setAdded] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);
    const [shared, setShared] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const getConditionLabel = () => {
        if (product.condition === "NEW") return "Baru";
        if (product.condition_rating) return `Pre-loved ${product.condition_rating}/10`;
        return "Pre-loved";
    };

    const groupedVariants = product.variants.reduce<Record<string, ProductInfoProps["product"]["variants"]>>(
        (acc, variant) => {
            if (!acc[variant.variant_type]) {
                acc[variant.variant_type] = [];
            }
            acc[variant.variant_type].push(variant);
            return acc;
        },
        {}
    );

    const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
    const displayPrice = selectedVariant?.price ?? product.price;
    const displayStock = selectedVariant?.stock ?? product.stock;
    const requiresVariantSelection = product.variants.length > 0 && !selectedVariant;

    const handleAddToCart = () => {
        startTransition(async () => {
            try {
                const result = await addToCart(product.id, 1, selectedVariant?.id);

                // Check for error response
                if (!result.success && result.error) {
                    if (result.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                    } else if (result.error === "own_product") {
                        alert("Anda tidak dapat menambahkan produk sendiri ke keranjang");
                    } else if (result.error === "product_not_available") {
                        alert("Produk tidak tersedia");
                    } else if (result.error === "variant_required") {
                        alert("Pilih varian produk terlebih dahulu");
                    } else if (result.error === "insufficient_stock") {
                        alert("Stok tidak mencukupi untuk varian yang dipilih");
                    }
                    return;
                }

                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
            } catch (error) {
                console.error("Failed to add to cart:", error);
            }
        });
    };

    const handleChatSeller = () => {
        if (!product.seller) return;

        startChatTransition(async () => {
            try {
                const result = await startConversation(product.seller!.id, product.id);

                // Check for error response (unauthorized, etc.)
                if (result.error) {
                    if (result.error === "unauthorized") {
                        // Redirect to login with return URL
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}&redirect=/messages`);
                    } else if (result.error === "cannot_message_self") {
                        alert("Anda tidak dapat mengirim pesan ke diri sendiri");
                    }
                    return;
                }

                // Success - navigate to chat
                if (result.conversationId) {
                    router.push(`/messages?c=${result.conversationId}`);
                }
            } catch (error) {
                console.error("Failed to start conversation:", error);
            }
        });
    };

    const handleAddToWishlist = () => {
        startWishlistTransition(async () => {
            try {
                const result = await addToWishlist(product.id);

                if (!result.success && result.error) {
                    if (result.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                    } else if (result.error === "own_product") {
                        alert("Anda tidak dapat menambahkan produk sendiri ke wishlist");
                    }
                    return;
                }

                setWishlisted(true);
                setTimeout(() => setWishlisted(false), 2000);
            } catch (error) {
                console.error("Failed to add to wishlist:", error);
            }
        });
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        const shareTitle = product.title;
        const shareText = `Lihat ${product.title} di Jual Beli Raket!`;

        try {
            // Try Web Share API first (mobile/modern browsers)
            if (navigator.share) {
                await navigator.share({
                    title: shareTitle,
                    text: shareText,
                    url: shareUrl,
                });
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            }
        } catch (error) {
            // If share was cancelled or failed, try clipboard
            try {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            } catch {
                console.error("Failed to share:", error);
            }
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                        {product.category?.name || "Raket"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-100">
                        Kondisi: {getConditionLabel()}
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 font-heading leading-tight">
                    {product.title}
                </h1>
                <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-slate-500">Stok: {displayStock}</span>
                </div>
            </div>

            <div className="flex items-baseline gap-3 pb-6 border-b border-slate-100">
                <span className="text-4xl font-bold text-brand-primary font-heading">
                    {formatPrice(displayPrice)}
                </span>
            </div>

            {product.variants.length > 0 && (
                <div className="space-y-2">
                    <VariantSelector
                        variants={product.variants}
                        grouped={groupedVariants}
                        basePrice={product.price}
                        onVariantSelect={(variant) => setSelectedVariantId(variant?.id ?? null)}
                    />
                    {requiresVariantSelection && (
                        <p className="text-sm text-amber-600">Pilih varian sebelum menambahkan ke keranjang.</p>
                    )}
                </div>
            )}

            {/* Seller Info */}
            {product.seller && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        {product.seller.image ? (
                            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white shadow-sm">
                                <Image
                                    src={product.seller.image}
                                    alt={product.seller.name}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center">
                                <span className="text-xl text-white font-bold">
                                    {(product.seller.store_name || product.seller.name).charAt(0).toUpperCase()}
                                </span>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">
                                    {product.seller.store_name || product.seller.name}
                                </span>
                                <ShieldCheck className="w-4 h-4 text-brand-primary" />
                            </div>
                            {sellerReputation && sellerReputation.ratingCount > 0 ? (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                                    <span className="font-semibold text-slate-700">
                                        ★ {sellerReputation.avgRating.toFixed(2)}
                                    </span>
                                    <span>({sellerReputation.ratingCount} ulasan)</span>
                                    <span>· {sellerReputation.completionRate.toFixed(0)}% selesai</span>
                                    <span>· respon {formatResponseTime(sellerReputation.responseTimeMinutes)}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Verified Seller</p>
                            )}
                        </div>
                    </div>
                    {product.seller.store_slug && (
                        <Link
                            href={`/store/${product.seller.store_slug}`}
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            View Profile
                        </Link>
                    )}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <button
                        onClick={handleAddToCart}
                        disabled={isPending || displayStock === 0 || requiresVariantSelection}
                        className="flex-1 bg-brand-primary hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : added ? (
                            <>✓ Ditambahkan</>
                        ) : (
                            <>
                                <ShoppingCart className="w-5 h-5" />
                                {displayStock === 0 ? "Stok Habis" : "Add to Cart"}
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleChatSeller}
                        disabled={isChatPending || !product.seller}
                        className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {isChatPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                <MessageCircle className="w-5 h-5" />
                                Tanya Penjual
                            </>
                        )}
                    </button>
                </div>
                {product.bargain_enabled && (
                    <MakeOfferButton
                        listingId={product.id}
                        listingPrice={parseFloat(product.price)}
                        autoDeclineBelow={product.auto_decline_below ? parseFloat(product.auto_decline_below) : null}
                    />
                )}
                <div className="flex gap-3">
                    <button
                        onClick={handleAddToWishlist}
                        disabled={isWishlistPending}
                        className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-red-500 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isWishlistPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : wishlisted ? (
                            <>
                                <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                                Ditambahkan!
                            </>
                        ) : (
                            <>
                                <Heart className="w-4 h-4" />
                                Add to Wishlist
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-brand-primary py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium"
                    >
                        {shared ? (
                            <>
                                <Share2 className="w-4 h-4" />
                                Link Disalin!
                            </>
                        ) : (
                            <>
                                <Share2 className="w-4 h-4" />
                                Share
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Garansi Keaslian</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            Produk asli atau uang kembali.
                        </p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                    <Truck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Pengiriman Aman</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                            Dilacak dengan asuransi pengiriman.
                        </p>
                    </div>
                </div>
            </div>

            {/* Description */}
            {product.description && (
                <div className="pt-6 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3">Deskripsi</h3>
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {product.description}
                    </div>
                </div>
            )}

            {/* Condition Notes */}
            {product.condition_notes && (
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3">Catatan Kondisi</h3>
                    <div className="text-sm text-slate-600 leading-relaxed bg-orange-50 p-4 rounded-lg border border-orange-100">
                        {product.condition_notes}
                    </div>
                </div>
            )}
        </div>
    );
}
