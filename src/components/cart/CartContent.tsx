"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Minus, Plus, Store, Verified, Loader2, Tag, ShieldCheck, BookmarkPlus, ShoppingCart, Clock } from "lucide-react";
import { removeFromCart, updateCartItemQuantity, clearCart, moveCartItemToSaved, moveSavedItemToCart } from "@/actions/cart";
import { effectiveUnitPrice } from "@/lib/offer-cart";

// Define the cart item type based on getCart return
interface CartItemType {
    id: string;
    quantity: number;
    saved_for_later: boolean;
    offer_id: string | null;
    offer: {
        id: string;
        amount: string;
        status: string;
        checkout_token: string | null;
        checkout_token_expires_at: string | Date | null;
    } | null;
    variant: {
        id: string;
        name: string;
        variant_type: string;
        price: string | null;
        stock: number;
        is_available: boolean;
    } | null;
    product: {
        id: string;
        title: string;
        slug: string;
        price: string;
        images: string[] | null;
        condition: string;
        condition_rating: number | null;
        seller: {
            id: string;
            name: string | null;
            store_name: string | null;
        };
        variants: { id: string }[];
    };
}

interface CartContentProps {
    initialItems: CartItemType[];
}

export function CartContent({ initialItems }: CartContentProps) {
    const router = useRouter();
    const [items, setItems] = useState<CartItemType[]>(initialItems);
    const [isPending, startTransition] = useTransition();
    const [moveError, setMoveError] = useState<string | null>(null);

    // Tick once a minute so the offer countdown stays roughly live.
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(t);
    }, []);

    // REC-03: split active cart from saved-for-later. Accepted-offer items
    // (locked nego price + 24h window) shown in their own section but checked
    // out together with the rest via the per-item checkboxes.
    const offerItems = items.filter((i) => i.offer_id && i.offer && !i.saved_for_later);
    const activeItems = items.filter((i) => !i.saved_for_later && !i.offer_id);
    const savedItems = items.filter((i) => i.saved_for_later);

    // Checkbox selection (Tokopedia/Shopee style): all checkable lines, ticked
    // by default; the total + "Beli" follow what's ticked.
    const checkableIds = useMemo(
        () => [...offerItems, ...activeItems].map((i) => i.id),
        [offerItems, activeItems]
    );
    const [checked, setChecked] = useState<Set<string>>(() => new Set(checkableIds));
    // Keep selection in sync as lines come/go: prune removed ids, keep the user's
    // choices for survivors, and default-check brand-new lines.
    const knownIdsRef = useRef<Set<string>>(new Set(checkableIds));
    useEffect(() => {
        setChecked((prev) => {
            const next = new Set<string>();
            for (const id of checkableIds) {
                if (!knownIdsRef.current.has(id) || prev.has(id)) next.add(id);
            }
            return next;
        });
        knownIdsRef.current = new Set(checkableIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [checkableIds.join(",")]);

    const toggleItem = (id: string) =>
        setChecked((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    const allChecked = checkableIds.length > 0 && checkableIds.every((id) => checked.has(id));
    const toggleAll = () => setChecked(allChecked ? new Set() : new Set(checkableIds));

    const checkedItems = [...offerItems, ...activeItems].filter((i) => checked.has(i.id));
    const checkedSubtotal = checkedItems.reduce((sum, i) => sum + effectiveUnitPrice(i) * i.quantity, 0);
    const checkedCount = checkedItems.length;
    const goToCheckout = () => {
        if (checkedCount === 0) return;
        router.push(`/checkout?items=${[...checked].join(",")}`);
    };

    const formatRemaining = (expiresAt: string | Date | null): string | null => {
        if (!expiresAt) return null;
        const ms = new Date(expiresAt).getTime() - now;
        if (ms <= 0) return "kedaluwarsa";
        const mins = Math.floor(ms / 60_000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h} jam ${m} menit` : `${m} menit`;
    };

    // Group active items by seller
    const itemsBySeller = activeItems.reduce((acc, item) => {
        const sellerId = item.product.seller.id;
        if (!acc[sellerId]) {
            acc[sellerId] = {
                seller: item.product.seller,
                items: [],
            };
        }
        acc[sellerId].items.push(item);
        return acc;
    }, {} as Record<string, { seller: CartItemType["product"]["seller"]; items: CartItemType[] }>);

    const handleMoveToSaved = (cartItemId: string) => {
        setMoveError(null);
        startTransition(async () => {
            try {
                const res = await moveCartItemToSaved(cartItemId);
                if (res && "success" in res && res.success === false) {
                    setMoveError(res.error || "Gagal memindahkan item.");
                    return;
                }
                setItems((prev) => prev.map((i) => (i.id === cartItemId ? { ...i, saved_for_later: true } : i)));
            } catch (error) {
                setMoveError(error instanceof Error ? error.message : "Gagal memindahkan item.");
            }
        });
    };

    const handleMoveToCart = (cartItemId: string) => {
        setMoveError(null);
        startTransition(async () => {
            try {
                const res = await moveSavedItemToCart(cartItemId);
                if (res && "success" in res && res.success === false) {
                    setMoveError(res.error || "Gagal memindahkan item.");
                    return;
                }
                setItems((prev) => prev.map((i) => (i.id === cartItemId ? { ...i, saved_for_later: false } : i)));
            } catch (error) {
                setMoveError(error instanceof Error ? error.message : "Gagal memindahkan item.");
            }
        });
    };

    const handleUpdateQuantity = (cartItemId: string, newQuantity: number) => {
        startTransition(async () => {
            try {
                if (newQuantity <= 0) {
                    await removeFromCart(cartItemId);
                    setItems((prev) => prev.filter((item) => item.id !== cartItemId));
                } else {
                    await updateCartItemQuantity(cartItemId, newQuantity);
                    setItems((prev) =>
                        prev.map((item) =>
                            item.id === cartItemId ? { ...item, quantity: newQuantity } : item
                        )
                    );
                }
            } catch (error) {
                console.error("Failed to update quantity:", error);
            }
        });
    };

    const handleRemove = (cartItemId: string) => {
        startTransition(async () => {
            try {
                await removeFromCart(cartItemId);
                setItems((prev) => prev.filter((item) => item.id !== cartItemId));
            } catch (error) {
                console.error("Failed to remove item:", error);
            }
        });
    };

    const handleClearCart = () => {
        startTransition(async () => {
            try {
                await clearCart();
                setItems([]);
            } catch (error) {
                console.error("Failed to clear cart:", error);
            }
        });
    };

    // Variant-resolution gate applies only to ticked non-offer lines.
    const hasVariantResolutionErrors = checkedItems.some(
        (item) => item.product.variants.length > 0 && !item.variant
    );

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* LEFT COLUMN: Cart Items */}
            <div className="flex-1 w-full min-w-0 flex flex-col gap-5">
                {/* Select All / Clear */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={toggleAll}
                            className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                        />
                        <span className="text-slate-700 text-base font-medium">
                            Pilih Semua ({checkableIds.length})
                            {savedItems.length > 0 ? ` · ${savedItems.length} disimpan` : ""}
                        </span>
                    </label>
                    <button
                        onClick={handleClearCart}
                        disabled={isPending}
                        className="text-slate-500 hover:text-red-500 font-medium text-sm transition-colors disabled:opacity-50"
                    >
                        Hapus Semua
                    </button>
                </div>

                {moveError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                        {moveError}
                    </div>
                )}

                {/* Accepted-offer items: locked nego price + 24h window. Checked out
                    together with the rest via the per-item checkbox (locked price
                    is applied server-side). */}
                {offerItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                        <div className="p-4 border-b border-emerald-100 bg-emerald-50/60 flex items-center gap-2">
                            <Tag className="w-4 h-4 text-emerald-600" />
                            <h3 className="font-bold text-emerald-800">Penawaran Diterima ({offerItems.length})</h3>
                            <span className="text-xs text-emerald-700">harga nego terkunci · checkout dalam 24 jam</span>
                        </div>
                        {offerItems.map((item) => {
                            const remaining = formatRemaining(item.offer?.checkout_token_expires_at ?? null);
                            const negoPrice = item.offer ? parseFloat(item.offer.amount) : parseFloat(item.product.price);
                            return (
                                <div key={item.id} className="p-4 flex gap-3 sm:gap-4 items-start sm:items-center border-t border-emerald-100 first:border-t-0">
                                    <input
                                        type="checkbox"
                                        checked={checked.has(item.id)}
                                        onChange={() => toggleItem(item.id)}
                                        className="mt-1 sm:mt-0 w-4 h-4 flex-shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        aria-label={`Pilih ${item.product.title}`}
                                    />
                                    <Link href={`/product/${item.product.slug}`}>
                                        <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                            <Image alt={item.product.title} className="object-cover" src={item.product.images?.[0] || "/placeholder.png"} fill />
                                        </div>
                                    </Link>
                                    <div className="flex-1 flex flex-col min-w-0 gap-1">
                                        <Link href={`/product/${item.product.slug}`}>
                                            <h4 className="text-slate-800 text-base font-semibold line-clamp-2 hover:text-brand-primary transition-colors">{item.product.title}</h4>
                                        </Link>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-emerald-700 text-lg font-bold">{formatPrice(negoPrice)}</span>
                                            {parseFloat(item.product.price) > negoPrice && (
                                                <span className="text-sm text-slate-400 line-through">{formatPrice(parseFloat(item.product.price))}</span>
                                            )}
                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Harga Nego</span>
                                        </div>
                                        {item.variant && <p className="text-sm text-slate-500">Varian: {item.variant.name}</p>}
                                        <div className={`flex items-center gap-1 text-xs ${remaining === "kedaluwarsa" ? "text-rose-600" : "text-amber-600"}`}>
                                            <Clock className="w-3.5 h-3.5" />
                                            {remaining === "kedaluwarsa" ? "Penawaran kedaluwarsa" : `Kedaluwarsa dalam ${remaining}`}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        disabled={isPending}
                                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 flex-shrink-0 self-start"
                                        title="Hapus dari keranjang"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Items grouped by seller */}
                {Object.values(itemsBySeller).map(({ seller, items: sellerItems }) => (
                    <div
                        key={seller.id}
                        className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
                    >
                        {/* Seller Header */}
                        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Store className="w-4 h-4 text-slate-500" />
                                <span className="text-slate-900 font-bold">
                                    {seller.store_name || seller.name || "Seller"}
                                </span>
                                <Verified className="w-4 h-4 text-brand-primary" />
                            </div>
                        </div>

                        {/* Items */}
                        {sellerItems.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex flex-row gap-3 sm:gap-4 items-start sm:items-center border-t border-slate-100 first:border-t-0"
                            >
                                <input
                                    type="checkbox"
                                    checked={checked.has(item.id)}
                                    onChange={() => toggleItem(item.id)}
                                    className="mt-1 sm:mt-0 w-4 h-4 flex-shrink-0 rounded border-slate-300 text-brand-primary focus:ring-brand-primary cursor-pointer"
                                    aria-label={`Pilih ${item.product.title}`}
                                />
                                {/* Image */}
                                <Link href={`/product/${item.product.slug}`}>
                                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                        <Image
                                            alt={item.product.title}
                                            className="object-cover"
                                            src={item.product.images?.[0] || "/placeholder.png"}
                                            fill
                                        />
                                    </div>
                                </Link>

                                {/* Details */}
                                <div className="flex-1 flex flex-col min-w-0 gap-1">
                                    <Link href={`/product/${item.product.slug}`}>
                                        <h4 className="text-slate-800 text-base font-semibold line-clamp-2 hover:text-brand-primary transition-colors">
                                            {item.product.title}
                                        </h4>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                                            {item.product.condition === "NEW" ? "Baru" : `Pre-loved ${item.product.condition_rating ? `${item.product.condition_rating}/10` : ""}`}
                                        </span>
                                    </div>
                                    <div className="text-slate-900 text-lg font-bold">
                                        {formatPrice(parseFloat(item.variant?.price ?? item.product.price))}
                                    </div>
                                    {item.variant && (
                                        <p className="text-sm text-slate-500">
                                            Varian: {item.variant.name}
                                        </p>
                                    )}
                                    {!item.variant && item.product.variants.length > 0 && (
                                        <p className="text-sm text-amber-600">
                                            Varian lama perlu dipilih ulang sebelum checkout.
                                        </p>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleMoveToSaved(item.id)}
                                            disabled={isPending}
                                            className="text-slate-400 hover:text-brand-primary transition-colors disabled:opacity-50"
                                            title="Simpan untuk nanti"
                                        >
                                            <BookmarkPlus className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleRemove(item.id)}
                                            disabled={isPending}
                                            className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                            title="Hapus"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden h-8">
                                        <button
                                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                            disabled={isPending}
                                            className="w-8 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-10 h-full flex items-center justify-center text-sm font-medium bg-white text-slate-900">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                            disabled={isPending}
                                            className="w-8 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                {/* REC-03: Saved for later panel */}
                {savedItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                            <BookmarkPlus className="w-4 h-4 text-slate-500" />
                            <h3 className="font-bold text-slate-900">Disimpan untuk Nanti ({savedItems.length})</h3>
                        </div>
                        {savedItems.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center border-t border-slate-100 first:border-t-0 opacity-90"
                            >
                                <Link href={`/product/${item.product.slug}`}>
                                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-white">
                                        <Image
                                            alt={item.product.title}
                                            className="object-cover"
                                            src={item.product.images?.[0] || "/placeholder.png"}
                                            fill
                                        />
                                    </div>
                                </Link>
                                <div className="flex-1 flex flex-col min-w-0 gap-1">
                                    <Link href={`/product/${item.product.slug}`}>
                                        <h4 className="text-slate-800 text-sm font-semibold line-clamp-2 hover:text-brand-primary transition-colors">
                                            {item.product.title}
                                        </h4>
                                    </Link>
                                    <div className="text-slate-900 text-base font-bold">
                                        {formatPrice(parseFloat(item.variant?.price ?? item.product.price))}
                                    </div>
                                    {item.variant && (
                                        <p className="text-xs text-slate-500">Varian: {item.variant.name}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleMoveToCart(item.id)}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand-primary text-white hover:bg-blue-600 disabled:opacity-50"
                                        title="Pindah ke keranjang"
                                    >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                        Beli
                                    </button>
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        disabled={isPending}
                                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50 p-1.5"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* RIGHT COLUMN: Order Summary */}
            <div className="w-full lg:w-[380px] flex-shrink-0 lg:sticky lg:top-24">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col gap-5">
                    <h3 className="text-slate-900 text-lg font-bold">Ringkasan Belanja</h3>

                    {/* Promo codes are applied at checkout (where the discount is computed
                        and validated server-side), not on the cart. */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                        <Tag className="w-4 h-4 text-brand-primary" />
                        Punya kode promo? Masukkan saat checkout.
                    </div>

                    <hr className="border-slate-200" />

                    {/* Price Breakdown — follows the ticked items. */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span>Total Harga ({checkedCount} Barang)</span>
                            <span>{formatPrice(checkedSubtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span>Total Diskon</span>
                            <span className="text-slate-900 font-medium">-Rp 0</span>
                        </div>
                    </div>

                    <hr className="border-slate-200" />

                    <div className="flex justify-between items-end">
                        <span className="text-base font-bold text-slate-900">Total Harga</span>
                        <span className="text-xl font-bold text-brand-primary">
                            {formatPrice(checkedSubtotal)}
                        </span>
                    </div>

                    {/* CTA Button — buys all ticked items together. */}
                    <button
                        onClick={goToCheckout}
                        disabled={isPending || checkedCount === 0 || hasVariantResolutionErrors}
                        className="w-full bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-brand-primary/30 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                    >
                        {isPending ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            `Beli (${checkedCount})`
                        )}
                    </button>

                    {hasVariantResolutionErrors && (
                        <p className="text-sm text-amber-600">
                            Beberapa item memerlukan pemilihan ulang varian dari halaman produk.
                        </p>
                    )}

                    {/* Trust Badge */}
                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                        <ShieldCheck className="w-4 h-4" />
                        <span>Jaminan Aman & Terpercaya</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
