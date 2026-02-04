import { notFound } from "next/navigation";
import { db } from "@/db";
import { users, products } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { Store, Package, Star, MapPin, Calendar, ChevronRight } from "lucide-react";

type Props = {
    params: Promise<{ slug: string }>;
};

async function getSellerBySlug(slug: string) {
    const seller = await db.query.users.findFirst({
        where: eq(users.store_slug, slug),
    });
    return seller;
}

async function getSellerProducts(sellerId: string) {
    const sellerProducts = await db
        .select()
        .from(products)
        .where(
            and(
                eq(products.seller_id, sellerId),
                eq(products.status, "PUBLISHED")
            )
        )
        .orderBy(desc(products.created_at))
        .limit(20);
    return sellerProducts;
}

function formatPrice(price: string | number): string {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numPrice);
}

export default async function StorePage({ params }: Props) {
    const { slug } = await params;
    const seller = await getSellerBySlug(slug);

    if (!seller || !seller.store_name) {
        notFound();
    }

    const sellerProducts = await getSellerProducts(seller.id);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
            {/* Store Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                        <Link href="/" className="hover:text-brand-primary">
                            Home
                        </Link>
                        <ChevronRight className="w-4 h-4" />
                        <span className="text-slate-900 dark:text-white">
                            {seller.store_name}
                        </span>
                    </nav>

                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        {/* Store Avatar */}
                        <div className="w-24 h-24 bg-gradient-to-br from-brand-primary to-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {seller.store_name.charAt(0).toUpperCase()}
                        </div>

                        {/* Store Info */}
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
                                    {seller.store_name}
                                </h1>
                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full">
                                    Verified
                                </span>
                            </div>

                            {seller.store_description && (
                                <p className="text-slate-600 dark:text-slate-400 mb-4 max-w-2xl">
                                    {seller.store_description}
                                </p>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <Package className="w-4 h-4" />
                                    <span>{sellerProducts.length} produk</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Star className="w-4 h-4 text-yellow-500" />
                                    <span>4.8 rating</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        Bergabung{" "}
                                        {new Date(seller.createdAt).toLocaleDateString("id-ID", {
                                            month: "long",
                                            year: "numeric",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button className="px-6 py-2.5 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary/90 transition-colors">
                                Follow
                            </button>
                            <button className="px-6 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                Chat
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Store Products */}
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                        Produk dari Toko Ini
                    </h2>
                    <span className="text-sm text-slate-500">
                        {sellerProducts.length} produk
                    </span>
                </div>

                {sellerProducts.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl">
                        <Store className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                            Belum ada produk
                        </h3>
                        <p className="text-slate-500">
                            Toko ini belum memiliki produk yang dijual
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {sellerProducts.map((product) => (
                            <Link
                                key={product.id}
                                href={`/product/${product.slug}`}
                                className="group bg-white dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 hover:shadow-lg transition-all duration-300"
                            >
                                {/* Image */}
                                <div className="relative aspect-square bg-slate-100 dark:bg-slate-700">
                                    {product.images && product.images.length > 0 ? (
                                        <Image
                                            src={product.images[0]}
                                            alt={product.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Package className="w-10 h-10 text-slate-400" />
                                        </div>
                                    )}
                                    {product.condition === "PRELOVED" && (
                                        <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded">
                                            Preloved
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 mb-1 group-hover:text-brand-primary transition-colors">
                                        {product.title}
                                    </h3>
                                    <p className="text-sm font-bold text-brand-primary">
                                        {formatPrice(product.price)}
                                    </p>
                                    {product.brand && (
                                        <p className="text-xs text-slate-500 mt-1">
                                            {product.brand}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
