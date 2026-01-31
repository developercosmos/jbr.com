import Link from "next/link";
import { ChevronRight, Info, ShoppingCart } from "lucide-react";
import { getCart } from "@/actions/cart";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { CartContent } from "@/components/cart/CartContent";

export default async function CartPage() {
    // Check if user is logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    // If not logged in, show guest cart message
    if (!session?.user) {
        return (
            <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12 py-6">
                {/* Breadcrumbs */}
                <div className="flex flex-wrap gap-2 items-center mb-6">
                    <Link
                        href="/"
                        className="text-slate-500 hover:text-brand-primary text-sm font-medium"
                    >
                        Beranda
                    </Link>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                    <span className="text-slate-900 text-sm font-medium">
                        Keranjang
                    </span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mb-6">
                    Keranjang
                </h1>

                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
                    <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Keranjang Kosong</h2>
                    <p className="text-slate-500 mb-6 text-center max-w-md">
                        Silakan masuk untuk melihat keranjang belanja Anda.
                    </p>
                    <div className="flex gap-3">
                        <Link
                            href="/auth/login"
                            className="px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                        >
                            Masuk
                        </Link>
                        <Link
                            href="/"
                            className="px-6 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-xl transition-colors"
                        >
                            Lanjut Belanja
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    // Fetch cart data
    let cartItems: Awaited<ReturnType<typeof getCart>> = [];
    try {
        cartItems = await getCart();
    } catch {
        cartItems = [];
    }

    return (
        <main className="flex-grow w-full max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12 py-6">
            {/* Breadcrumbs */}
            <div className="flex flex-wrap gap-2 items-center mb-6">
                <Link
                    href="/"
                    className="text-slate-500 hover:text-brand-primary text-sm font-medium"
                >
                    Beranda
                </Link>
                <ChevronRight className="w-4 h-4 text-slate-500" />
                <span className="text-slate-900 text-sm font-medium">
                    Keranjang
                </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mb-6">
                Keranjang
            </h1>

            {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
                    <ShoppingCart className="w-16 h-16 text-slate-300 mb-4" />
                    <h2 className="text-xl font-bold text-slate-700 mb-2">Keranjang Kosong</h2>
                    <p className="text-slate-500 mb-6">
                        Belum ada produk di keranjang Anda.
                    </p>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                    >
                        Mulai Belanja
                    </Link>
                </div>
            ) : (
                <CartContent initialItems={cartItems} />
            )}
        </main>
    );
}
