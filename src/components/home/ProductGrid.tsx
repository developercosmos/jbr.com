import Link from "next/link";
import Image from "next/image";
import { Heart } from "lucide-react";
import { getPublishedProducts } from "@/actions/products";

export async function ProductGrid() {
    const products = await getPublishedProducts(8);

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const getConditionLabel = (condition: string, rating: number | null) => {
        if (condition === "NEW") return "Baru";
        if (rating) return `Pre-loved ${rating}/10`;
        return "Pre-loved";
    };

    if (products.length === 0) {
        return (
            <section className="py-16 bg-slate-50">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 font-heading">Featured Listings</h2>
                    </div>
                    <div className="text-center py-16">
                        <p className="text-slate-500 text-lg">Belum ada produk tersedia.</p>
                        <Link href="/seller/products/add" className="inline-block mt-4 px-6 py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors">
                            Jual Produk Pertama
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="py-16 bg-slate-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-slate-900 font-heading">Featured Listings</h2>
                    <Link href="/category/all" className="text-sm font-semibold text-brand-primary hover:text-blue-700 transition-colors">
                        View All Products &rarr;
                    </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <Link key={product.id} href={`/product/${product.slug}`} className="group block">
                            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
                                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-slate-700 text-xs font-bold px-2 py-1 rounded shadow-sm z-10">
                                        {getConditionLabel(product.condition, product.condition_rating)}
                                    </span>
                                    <button className="absolute top-3 right-3 p-1.5 bg-white/60 backdrop-blur-sm rounded-full text-slate-600 hover:bg-red-50 hover:text-red-500 transition-colors z-10">
                                        <Heart className="w-4 h-4" />
                                    </button>
                                    {product.images && product.images.length > 0 ? (
                                        <Image
                                            src={product.images[0]}
                                            alt={product.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-slate-200">
                                            <span className="text-slate-400">No Image</span>
                                        </div>
                                    )}
                                </div>

                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-xs font-medium text-slate-500 mb-1">
                                                {product.category?.name || "Raket"}
                                            </p>
                                            <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-brand-primary transition-colors">
                                                {product.title}
                                            </h3>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                                        <div className="flex items-center gap-2">
                                            {product.seller?.image ? (
                                                <div className="relative w-5 h-5 rounded-full overflow-hidden bg-slate-200">
                                                    <Image src={product.seller.image} alt={product.seller.name} fill className="object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-full bg-brand-primary flex items-center justify-center">
                                                    <span className="text-[10px] text-white font-bold">
                                                        {(product.seller?.store_name || product.seller?.name || "S").charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            )}
                                            <span className="text-xs text-slate-600 truncate max-w-[80px]">
                                                {product.seller?.store_name || product.seller?.name || "Seller"}
                                            </span>
                                        </div>
                                        <p className="font-bold text-brand-primary">{formatPrice(product.price)}</p>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
