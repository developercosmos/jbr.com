"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock, Home, Verified, MapPin, CreditCard, ClipboardCheck } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { getCheckoutShippingQuote } from "@/actions/shipping";

type CheckoutAddress = {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    full_address: string;
    postal_code: string | null;
    is_default_shipping: boolean | null;
};

type CheckoutCartItem = {
    id: string;
    quantity: number;
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
        price: string;
        images: string[] | null;
        condition: "NEW" | "PRELOVED";
        condition_rating: number | null;
        variants: { id: string }[];
        seller: {
            name: string | null;
            store_name: string | null;
        };
    };
};

type PaymentMethod = "BANK_TRANSFER" | "EWALLET" | "COD";

type CheckoutShippingQuote = {
    success: boolean;
    courier: "jne" | "pos" | "tiki";
    totalCost: number;
    quotesBySeller: Array<{
        sellerId: string;
        shippingProvider: string;
        service: string;
        description: string;
        cost: number;
        etd: string;
    }>;
    warning?: string;
    usedFallback: boolean;
};

interface CheckoutPageClientProps {
    userName: string;
    cartItems: CheckoutCartItem[];
    addresses: CheckoutAddress[];
    subtotal: number;
    shippingCost: number;
    serviceFee: number;
    initialShippingQuote: CheckoutShippingQuote | null;
}

function formatPrice(price: number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(price);
}

export function CheckoutPageClient({
    userName,
    cartItems,
    addresses,
    subtotal,
    shippingCost,
    serviceFee,
    initialShippingQuote,
}: CheckoutPageClientProps) {
    const defaultAddress = useMemo(
        () => addresses.find((addr) => addr.is_default_shipping) ?? addresses[0] ?? null,
        [addresses]
    );

    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(defaultAddress?.id ?? null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("BANK_TRANSFER");
    const [selectedCourier, setSelectedCourier] = useState<"jne" | "pos" | "tiki">("jne");
    const [shippingQuote, setShippingQuote] = useState<CheckoutShippingQuote | null>(initialShippingQuote);
    const [shippingError, setShippingError] = useState<string>("");
    const [isShippingPending, startShippingTransition] = useTransition();

    const selectedAddress = useMemo(
        () => addresses.find((addr) => addr.id === selectedAddressId) ?? null,
        [addresses, selectedAddressId]
    );

    const hasVariantResolutionErrors = useMemo(
        () => cartItems.some((item) => item.product.variants.length > 0 && !item.variant),
        [cartItems]
    );

    const effectiveShippingQuote = selectedAddressId && !hasVariantResolutionErrors ? shippingQuote : null;

    useEffect(() => {
        if (!selectedAddressId || hasVariantResolutionErrors) {
            return;
        }

        let cancelled = false;

        startShippingTransition(async () => {
            try {
                const result = await getCheckoutShippingQuote({
                    addressId: selectedAddressId,
                    courier: selectedCourier,
                });

                if (!cancelled) {
                    setShippingQuote(result);
                    setShippingError("");
                }
            } catch (error) {
                if (!cancelled) {
                    setShippingQuote(null);
                    setShippingError(error instanceof Error ? error.message : "Gagal mengambil ongkir");
                }
            }
        });

        return () => {
            cancelled = true;
        };
    }, [hasVariantResolutionErrors, selectedAddressId, selectedCourier]);

    const resolvedShippingCost = effectiveShippingQuote?.totalCost ?? shippingCost;
    const resolvedTotal = subtotal + resolvedShippingCost + serviceFee;
    const canCheckout = Boolean(
        selectedAddressId &&
        paymentMethod &&
        !hasVariantResolutionErrors &&
        effectiveShippingQuote?.success &&
        !isShippingPending
    );

    return (
        <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 lg:px-16 py-5">
            <div className="flex flex-wrap gap-2 pb-2 pt-4">
                <Link href="/" className="text-slate-500 hover:text-brand-primary text-sm font-medium">
                    Home
                </Link>
                <span className="text-slate-500 text-sm">/</span>
                <Link href="/cart" className="text-slate-500 hover:text-brand-primary text-sm font-medium">
                    Cart
                </Link>
                <span className="text-slate-500 text-sm">/</span>
                <span className="text-slate-900 text-sm font-medium">Checkout</span>
            </div>

            <div className="flex flex-wrap justify-between gap-3 pb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">
                    Checkout
                </h1>
                <div className="flex items-center gap-2 text-green-600 bg-green-100 px-3 py-1 rounded-full border border-green-200">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wide">Secure Checkout</span>
                </div>
            </div>

            <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-brand-primary bg-brand-primary/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-brand-primary">
                        <MapPin className="w-4 h-4" />
                        1. Address
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Pilih alamat pengiriman</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <CreditCard className="w-4 h-4" />
                        2. Payment
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Pilih metode pembayaran</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ClipboardCheck className="w-4 h-4" />
                        3. Review
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Konfirmasi dan bayar</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 flex flex-col gap-8">
                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Alamat Pengiriman
                        </h2>

                        {addresses.length === 0 ? (
                            <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2">
                                        <Home className="w-5 h-5 text-brand-primary" />
                                        <p className="text-slate-900 text-base font-bold">{userName || "User"}</p>
                                    </div>
                                    <p className="text-slate-500 text-sm">
                                        Alamat belum diatur.
                                        <br />
                                        Tambahkan alamat pengiriman sebelum checkout.
                                    </p>
                                </div>
                                <Link
                                    href="/profile/address"
                                    className="rounded-lg h-9 px-4 border border-slate-300 hover:bg-slate-100 text-slate-900 text-sm font-medium transition-colors inline-flex items-center"
                                >
                                    Tambah Alamat
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {addresses.map((address) => {
                                    const isSelected = selectedAddressId === address.id;
                                    return (
                                        <label
                                            key={address.id}
                                            className={`block rounded-xl border p-4 cursor-pointer transition-colors ${
                                                isSelected
                                                    ? "border-brand-primary bg-brand-primary/5"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="shipping_address"
                                                value={address.id}
                                                checked={isSelected}
                                                onChange={() => setSelectedAddressId(address.id)}
                                                className="sr-only"
                                            />
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-slate-900 font-bold text-sm">
                                                            {address.recipient_name} ({address.label})
                                                        </p>
                                                        {address.is_default_shipping && (
                                                            <span className="bg-brand-primary/20 text-brand-primary text-[10px] px-2 py-0.5 rounded font-bold uppercase">
                                                                Utama
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-slate-600 text-sm mt-1">{address.phone}</p>
                                                    <p className="text-slate-500 text-sm mt-1">
                                                        {address.full_address}
                                                        {address.postal_code ? `, ${address.postal_code}` : ""}
                                                    </p>
                                                </div>
                                                {isSelected && (
                                                    <span className="text-brand-primary text-xs font-semibold">Dipilih</span>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                                <Link href="/profile/address" className="text-sm font-medium text-brand-primary hover:underline">
                                    Kelola alamat
                                </Link>
                            </div>
                        )}
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Pengiriman
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { value: "jne", label: "JNE" },
                                { value: "pos", label: "POS" },
                                { value: "tiki", label: "TIKI" },
                            ].map((courier) => (
                                <label key={courier.value} className="cursor-pointer group">
                                    <input
                                        className="peer sr-only"
                                        name="courier"
                                        type="radio"
                                        checked={selectedCourier === courier.value}
                                        onChange={() => setSelectedCourier(courier.value as "jne" | "pos" | "tiki")}
                                    />
                                    <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-2 transition-all">
                                        <span className="text-slate-900 font-medium text-sm">{courier.label}</span>
                                        {shippingQuote?.courier === courier.value && shippingQuote.quotesBySeller[0] && (
                                            <span className="text-xs text-slate-500">
                                                Mulai {formatPrice(shippingQuote.quotesBySeller[0].cost)}
                                            </span>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                        {isShippingPending && (
                            <p className="text-sm text-slate-500">Mengambil ongkir terbaru...</p>
                        )}
                        {effectiveShippingQuote?.warning && (
                            <p className="text-sm text-amber-600">{effectiveShippingQuote.warning}</p>
                        )}
                        {shippingError && (
                            <p className="text-sm text-red-600">{shippingError}</p>
                        )}
                        {effectiveShippingQuote?.quotesBySeller.length ? (
                            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                                {effectiveShippingQuote.quotesBySeller.map((quote) => (
                                    <div key={`${quote.sellerId}-${quote.service}`} className="flex items-center justify-between gap-4 text-sm">
                                        <div>
                                            <p className="font-medium text-slate-900">{quote.shippingProvider}</p>
                                            <p className="text-slate-500">Estimasi {quote.etd} hari</p>
                                        </div>
                                        <span className="font-semibold text-slate-900">{formatPrice(quote.cost)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Rincian Pesanan ({cartItems.length} item)
                        </h2>
                        {cartItems.map((item) => (
                            <div key={item.id} className="flex flex-col sm:flex-row gap-5 p-5 rounded-xl border border-slate-200 bg-white">
                                <div className="shrink-0">
                                    <div className="w-full sm:w-32 h-32 rounded-lg bg-gray-200 overflow-hidden relative">
                                        <Image
                                            className="object-cover"
                                            alt={item.product.title}
                                            src={item.product.images?.[0] || "/placeholder.png"}
                                            fill
                                        />
                                        <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">
                                            {item.product.condition === "NEW" ? "Baru" : `Pre-loved ${item.product.condition_rating || ""}/10`}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col flex-1 justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-slate-900 text-lg font-bold">{item.product.title}</h3>
                                            <p className="text-slate-900 text-lg font-bold">
                                                {formatPrice(parseFloat(item.variant?.price ?? item.product.price) * item.quantity)}
                                            </p>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">Qty: {item.quantity}</p>
                                        {item.variant && (
                                            <p className="text-slate-500 text-sm mt-1">Varian: {item.variant.name}</p>
                                        )}
                                        {!item.variant && item.product.variants.length > 0 && (
                                            <p className="text-amber-600 text-sm mt-1">
                                                Item lama ini perlu dipilih ulang variannya dari halaman produk.
                                            </p>
                                        )}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                                        <span className="text-sm text-slate-500">
                                            {item.product.seller.store_name || item.product.seller.name || "Seller"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>

                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Metode Pembayaran
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="cursor-pointer group">
                                <input
                                    className="peer sr-only"
                                    name="payment"
                                    type="radio"
                                    checked={paymentMethod === "BANK_TRANSFER"}
                                    onChange={() => setPaymentMethod("BANK_TRANSFER")}
                                />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">Transfer Bank</span>
                                </div>
                            </label>
                            <label className="cursor-pointer group">
                                <input
                                    className="peer sr-only"
                                    name="payment"
                                    type="radio"
                                    checked={paymentMethod === "EWALLET"}
                                    onChange={() => setPaymentMethod("EWALLET")}
                                />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">E-Wallet</span>
                                </div>
                            </label>
                            <label className="cursor-pointer group">
                                <input
                                    className="peer sr-only"
                                    name="payment"
                                    type="radio"
                                    checked={paymentMethod === "COD"}
                                    onChange={() => setPaymentMethod("COD")}
                                />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">COD</span>
                                </div>
                            </label>
                        </div>
                    </section>
                </div>

                <div className="lg:col-span-4 relative">
                    <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 flex flex-col gap-5 shadow-xl">
                        <h3 className="text-slate-900 text-xl font-bold">Ringkasan Belanja</h3>
                        <div className="flex flex-col gap-3 pb-5 border-b border-slate-200 border-dashed">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Total Harga ({cartItems.length} Barang)</span>
                                <span className="text-slate-900 font-medium">{formatPrice(subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Biaya Pengiriman</span>
                                <span className="text-slate-900 font-medium">{formatPrice(resolvedShippingCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Biaya Layanan</span>
                                <span className="text-slate-900 font-medium">{formatPrice(serviceFee)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-slate-900 font-bold text-lg">Total Tagihan</span>
                            <span className="text-brand-primary font-black text-2xl">{formatPrice(resolvedTotal)}</span>
                        </div>

                        <CheckoutForm
                            selectedAddressId={selectedAddress?.id ?? null}
                            paymentMethod={paymentMethod}
                            shippingCourier={selectedCourier}
                            canCheckout={canCheckout}
                        />

                        {hasVariantResolutionErrors && (
                            <p className="text-sm text-amber-600">
                                Checkout dinonaktifkan sampai semua item varian dipilih ulang.
                            </p>
                        )}

                        <div className="flex items-start gap-2 text-xs text-slate-500 bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <Verified className="w-4 h-4 text-green-500 mt-0.5" />
                            <p>
                                Dengan membayar, Anda menyetujui Syarat & Ketentuan serta
                                jaminan transparansi kondisi barang.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
