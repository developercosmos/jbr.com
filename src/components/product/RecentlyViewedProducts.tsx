"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Clock, X } from "lucide-react";
import { db } from "@/db";
import { products } from "@/db/schema";
import { inArray, eq } from "drizzle-orm";

interface RecentlyViewedProps {
    currentProductId?: string;
}

type ViewedProduct = {
    id: string;
    title: string;
    slug: string;
    price: string;
    images: string[] | null;
};

export function RecentlyViewedProducts({ currentProductId }: RecentlyViewedProps) {
    const [viewedProducts, setViewedProducts] = useState<ViewedProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadRecentlyViewed = async () => {
            try {
                const storedIds = JSON.parse(
                    localStorage.getItem("recentlyViewed") || "[]"
                ) as string[];

                // Filter out current product
                const filteredIds = currentProductId
                    ? storedIds.filter((id) => id !== currentProductId)
                    : storedIds;

                if (filteredIds.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // Fetch product details from API
                const response = await fetch(
                    `/api/products/batch?ids=${filteredIds.slice(0, 6).join(",")}`
                );

                if (response.ok) {
                    const data = await response.json();
                    setViewedProducts(data.products || []);
                }
            } catch (error) {
                console.error("Error loading recently viewed:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadRecentlyViewed();
    }, [currentProductId]);

    const clearRecentlyViewed = () => {
        localStorage.removeItem("recentlyViewed");
        setViewedProducts([]);
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    if (isLoading || viewedProducts.length === 0) {
        return null;
    }

    return (
        <section className="mt-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-slate-600" />
                    <h2 className="text-lg font-bold text-slate-900">Terakhir Dilihat</h2>
                </div>
                <button
                    onClick={clearRecentlyViewed}
                    className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                >
                    <X className="w-3 h-3" />
                    Hapus Semua
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {viewedProducts.map((product) => (
                    <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className="group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all"
                    >
                        <div className="aspect-square relative bg-slate-100">
                            <Image
                                src={product.images?.[0] || "/placeholder.png"}
                                alt={product.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform"
                            />
                        </div>
                        <div className="p-3">
                            <h3 className="text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-brand-primary transition-colors">
                                {product.title}
                            </h3>
                            <p className="text-sm font-bold text-brand-primary mt-1">
                                {formatPrice(product.price)}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    );
}
