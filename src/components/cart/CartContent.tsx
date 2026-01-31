"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, Minus, Plus, Store, MapPin, Verified, Loader2, Tag, ShieldCheck } from "lucide-react";
import { removeFromCart, updateCartItemQuantity, clearCart } from "@/actions/cart";

// Define the cart item type based on getCart return
interface CartItemType {
    id: string;
    quantity: number;
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
    };
}

interface CartContentProps {
    initialItems: CartItemType[];
}

export function CartContent({ initialItems }: CartContentProps) {
    const [items, setItems] = useState<CartItemType[]>(initialItems);
    const [isPending, startTransition] = useTransition();

    // Group items by seller
    const itemsBySeller = items.reduce((acc, item) => {
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

    // Calculate totals
    const subtotal = items.reduce((sum, item) => {
        return sum + parseFloat(item.product.price) * item.quantity;
    }, 0);

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
                    <span className="text-slate-700 text-base font-medium">
                        {items.length} item{items.length !== 1 ? "s" : ""} dalam keranjang
                    </span>
                    <button
                        onClick={handleClearCart}
                        disabled={isPending}
                        className="text-slate-500 hover:text-red-500 font-medium text-sm transition-colors disabled:opacity-50"
                    >
                        Hapus Semua
                    </button>
                </div>

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
                                className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center border-t border-slate-100 first:border-t-0"
                            >
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
                                        {formatPrice(parseFloat(item.product.price))}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-4">
                                    <button
                                        onClick={() => handleRemove(item.id)}
                                        disabled={isPending}
                                        className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                        title="Hapus"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
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
            </div>

            {/* RIGHT COLUMN: Order Summary */}
            <div className="w-full lg:w-[380px] flex-shrink-0 lg:sticky lg:top-24">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 flex flex-col gap-5">
                    <h3 className="text-slate-900 text-lg font-bold">Ringkasan Belanja</h3>

                    {/* Coupon Input */}
                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 flex-1 border border-slate-300 rounded-lg px-3 py-2 bg-white">
                            <Tag className="w-5 h-5 text-brand-primary" />
                            <input
                                className="bg-transparent border-none p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 w-full outline-none"
                                placeholder="Kode Promo"
                                type="text"
                            />
                        </div>
                        <button className="text-sm font-semibold text-brand-primary hover:text-blue-600 px-2">
                            Gunakan
                        </button>
                    </div>

                    <hr className="border-slate-200" />

                    {/* Price Breakdown */}
                    <div className="flex flex-col gap-3">
                        <div className="flex justify-between items-center text-sm text-slate-600">
                            <span>Total Harga ({items.length} Barang)</span>
                            <span>{formatPrice(subtotal)}</span>
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
                            {formatPrice(subtotal)}
                        </span>
                    </div>

                    {/* CTA Button */}
                    <Link href="/checkout">
                        <button
                            disabled={isPending || items.length === 0}
                            className="w-full bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold py-3.5 rounded-lg shadow-lg shadow-brand-primary/30 transition-all active:scale-[0.98] flex justify-center items-center gap-2"
                        >
                            {isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                `Beli (${items.length})`
                            )}
                        </button>
                    </Link>

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
