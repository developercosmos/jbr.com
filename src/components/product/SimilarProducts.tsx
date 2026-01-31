import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { db } from "@/db";
import { products } from "@/db/schema";
import { eq, ne, and, desc } from "drizzle-orm";

type Props = {
    currentProductId?: string;
    categoryId?: string;
};

function formatPrice(price: string | number): string {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numPrice);
}

export async function SimilarProducts({ currentProductId, categoryId }: Props) {
    // Fetch similar products from database
    const similarProducts = await db
        .select()
        .from(products)
        .where(
            and(
                eq(products.status, "PUBLISHED"),
                currentProductId ? ne(products.id, currentProductId) : undefined
            )
        )
        .orderBy(desc(products.created_at))
        .limit(4);

    if (similarProducts.length === 0) {
        return null;
    }

    return (
        <div className="mt-20 border-t border-slate-200 dark:border-gray-800 pt-10 mb-10">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                Kamu mungkin juga suka
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {similarProducts.map((product) => (
                    <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className="group cursor-pointer block"
                    >
                        <div className="bg-surface-dark aspect-square rounded-lg mb-3 overflow-hidden relative">
                            {product.images && product.images.length > 0 ? (
                                <Image
                                    src={product.images[0]}
                                    alt={product.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                    <Package className="w-10 h-10 text-slate-400" />
                                </div>
                            )}
                            {product.condition === "PRELOVED" && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded">
                                    Preloved
                                </span>
                            )}
                        </div>
                        <h4 className="text-slate-900 dark:text-white font-medium text-sm truncate group-hover:text-brand-primary transition-colors">
                            {product.title}
                        </h4>
                        <p className="text-slate-500 text-xs mb-1">
                            {product.condition === "PRELOVED" && product.condition_rating
                                ? `Kondisi ${product.condition_rating}/10`
                                : product.condition === "NEW"
                                    ? "Baru"
                                    : "Preloved"}
                        </p>
                        <p className="text-slate-900 dark:text-white font-bold">
                            {formatPrice(product.price)}
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
