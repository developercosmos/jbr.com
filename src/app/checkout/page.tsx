import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCart } from "@/actions/cart";
import { getUserAddresses } from "@/actions/address";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckoutPageClient } from "@/components/checkout/CheckoutPageClient";
import { getCheckoutShippingQuote } from "@/actions/shipping";
import { db } from "@/db";
import { seller_ratings } from "@/db/schema";
import { eq } from "drizzle-orm";

function getBuyerProtectionRate(reliabilityScore: number): number {
    if (reliabilityScore >= 90) return 0;
    if (reliabilityScore >= 70) return 0.5;
    return 1;
}

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

    const addresses = await getUserAddresses();
    const defaultAddress = addresses.find((address) => address.is_default_shipping) ?? addresses[0] ?? null;

    let initialShippingQuote = null;
    if (defaultAddress) {
        try {
            initialShippingQuote = await getCheckoutShippingQuote({
                addressId: defaultAddress.id,
                courier: "jne",
            });
        } catch {
            initialShippingQuote = null;
        }
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.variant?.price ?? item.product.price) * item.quantity;
    }, 0);
    const shippingCost = initialShippingQuote?.totalCost ?? 0;
    const subtotalBySeller = cartItems.reduce<Record<string, number>>((acc, item) => {
        const sellerId = item.product.seller.id;
        const lineTotal = parseFloat(item.variant?.price ?? item.product.price) * item.quantity;
        acc[sellerId] = (acc[sellerId] ?? 0) + lineTotal;
        return acc;
    }, {});

    let serviceFee = 0;
    for (const [sellerId, sellerSubtotal] of Object.entries(subtotalBySeller)) {
        const rating = await db.query.seller_ratings.findFirst({
            where: eq(seller_ratings.user_id, sellerId),
            columns: { reliability_score: true },
        });
        const reliabilityScore = rating ? Number(rating.reliability_score) : 0;
        const rate = getBuyerProtectionRate(reliabilityScore);
        serviceFee += Math.round(sellerSubtotal * (rate / 100));
    }

    return (
        <CheckoutPageClient
            userName={session.user.name || "User"}
            cartItems={cartItems}
            addresses={addresses}
            subtotal={subtotal}
            shippingCost={shippingCost}
            serviceFee={serviceFee}
            initialShippingQuote={initialShippingQuote}
            trustInsuranceEnabled={serviceFee > 0}
        />
    );
}
