import Link from "next/link";
import Image from "next/image";
import { Lock, Home, Verified, ShoppingCart } from "lucide-react";
import { getCart } from "@/actions/cart";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";

export default async function CheckoutPage() {
    // Check if user is logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login?redirect=/checkout");
    }

    // Fetch cart data
    let cartItems: Awaited<ReturnType<typeof getCart>> = [];
    try {
        cartItems = await getCart();
    } catch {
        cartItems = [];
    }

    // If cart is empty, redirect to cart page
    if (cartItems.length === 0) {
        return (
            <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 lg:px-16 py-8">
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
                    <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Keranjang Kosong</h2>
                    <p className="text-slate-500 mb-6">
                        Tambahkan produk ke keranjang untuk checkout.
                    </p>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Mulai Belanja
                    </Link>
                </div>
            </main>
        );
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.product.price) * item.quantity;
    }, 0);
    const shippingCost = 20000;
    const serviceFee = 1000;
    const total = subtotal + shippingCost + serviceFee;

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(price);
    };

    return (
        <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 lg:px-16 py-5">
            {/* Breadcrumbs */}
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

            {/* Page Heading */}
            <div className="flex flex-wrap justify-between gap-3 pb-6">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">
                    Checkout
                </h1>
                <div className="flex items-center gap-2 text-green-600 bg-green-100 px-3 py-1 rounded-full border border-green-200">
                    <Lock className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wide">Secure Checkout</span>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-8 flex flex-col gap-8">
                    {/* Shipping Address */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Alamat Pengiriman
                        </h2>
                        <div className="flex flex-1 flex-col items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center shadow-sm">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                    <Home className="w-5 h-5 text-brand-primary" />
                                    <p className="text-slate-900 text-base font-bold">
                                        {session.user.name || "User"}
                                    </p>
                                    <span className="bg-brand-primary/20 text-brand-primary text-xs px-2 py-0.5 rounded font-bold uppercase">
                                        Utama
                                    </span>
                                </div>
                                <p className="text-slate-500 text-sm pl-[28px]">
                                    Alamat belum diatur
                                    <br />
                                    Silakan tambahkan alamat pengiriman
                                </p>
                            </div>
                            <button className="rounded-lg h-9 px-4 border border-slate-300 hover:bg-slate-100 text-slate-900 text-sm font-medium transition-colors">
                                Tambah Alamat
                            </button>
                        </div>
                    </section>

                    {/* Order Items */}
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
                                            <h3 className="text-slate-900 text-lg font-bold">
                                                {item.product.title}
                                            </h3>
                                            <p className="text-slate-900 text-lg font-bold">
                                                {formatPrice(parseFloat(item.product.price) * item.quantity)}
                                            </p>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">
                                            Qty: {item.quantity}
                                        </p>
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

                    {/* Payment Method */}
                    <section className="flex flex-col gap-4">
                        <h2 className="text-slate-900 text-[22px] font-bold border-b border-slate-200 pb-3">
                            Metode Pembayaran
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="cursor-pointer group">
                                <input className="peer sr-only" name="payment" type="radio" defaultChecked />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">Transfer Bank</span>
                                </div>
                            </label>
                            <label className="cursor-pointer group">
                                <input className="peer sr-only" name="payment" type="radio" />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">E-Wallet</span>
                                </div>
                            </label>
                            <label className="cursor-pointer group">
                                <input className="peer sr-only" name="payment" type="radio" />
                                <div className="h-full rounded-xl border-2 border-slate-200 peer-checked:border-brand-primary peer-checked:bg-brand-primary/5 p-4 flex flex-col gap-3 transition-all">
                                    <span className="text-slate-900 font-medium text-sm">COD</span>
                                </div>
                            </label>
                        </div>
                    </section>
                </div>

                {/* Right Column: Summary */}
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
                                <span className="text-slate-900 font-medium">{formatPrice(shippingCost)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Biaya Layanan</span>
                                <span className="text-slate-900 font-medium">{formatPrice(serviceFee)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-slate-900 font-bold text-lg">Total Tagihan</span>
                            <span className="text-brand-primary font-black text-2xl">{formatPrice(total)}</span>
                        </div>
                        <CheckoutForm />
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
