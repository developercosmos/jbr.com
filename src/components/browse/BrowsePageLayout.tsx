import Link from "next/link";
import Image from "next/image";
import { ChevronRight, ShoppingBag } from "lucide-react";

type Product = {
    id: string;
    title: string;
    slug: string;
    price: string;
    images: string[] | null;
    condition: "NEW" | "PRELOVED";
    condition_rating: number | null;
    seller: {
        id: string;
        name: string;
        store_name: string | null;
        image: string | null;
    } | null;
    category: {
        id: string;
        name: string;
        slug: string;
    } | null;
};

interface BrowsePageLayoutProps {
    title: string;
    subtitle?: string;
    breadcrumbItems: { label: string; href?: string }[];
    products: Product[];
    productCount: number;
    emptyMessage?: string;
}

export function BrowsePageLayout({
    title,
    subtitle,
    breadcrumbItems,
    products,
    productCount,
    emptyMessage = "Tidak ada produk ditemukan",
}: BrowsePageLayoutProps) {
    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    return (
        <main className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <div className="flex flex-wrap gap-2 items-center mb-4 text-sm">
                        {breadcrumbItems.map((item, index) => (
                            <span key={index} className="flex items-center gap-2">
                                {index > 0 && <ChevronRight className="w-4 h-4 text-slate-400" />}
                                {item.href ? (
                                    <Link
                                        href={item.href}
                                        className="text-slate-500 hover:text-brand-primary font-medium"
                                    >
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span className="text-slate-900 font-medium">{item.label}</span>
                                )}
                            </span>
                        ))}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mb-2">
                        {title}
                    </h1>

                    {subtitle && (
                        <p className="text-slate-500">{subtitle}</p>
                    )}

                    <p className="text-sm text-slate-500 mt-2">
                        Menampilkan {products.length} dari {productCount} produk
                    </p>
                </div>
            </div>

            {/* Product Grid */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                        <ShoppingBag className="w-16 h-16 text-slate-300 mb-4" />
                        <h2 className="text-xl font-bold text-slate-700 mb-2">{emptyMessage}</h2>
                        <p className="text-slate-500 mb-6">Coba ubah filter atau cari produk lainnya.</p>
                        <Link
                            href="/"
                            className="px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                        {products.map((product) => (
                            <Link
                                key={product.id}
                                href={`/product/${product.slug}`}
                                className="group bg-white rounded-xl overflow-hidden border border-slate-100 hover:border-brand-primary hover:shadow-lg transition-all"
                            >
                                {/* Image */}
                                <div className="relative aspect-square bg-slate-100">
                                    {product.images && product.images[0] ? (
                                        <Image
                                            src={product.images[0]}
                                            alt={product.title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <ShoppingBag className="w-12 h-12" />
                                        </div>
                                    )}
                                    {/* Condition Badge */}
                                    <div className="absolute top-2 left-2">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${product.condition === "NEW"
                                                ? "bg-green-100 text-green-700"
                                                : "bg-orange-100 text-orange-700"
                                            }`}>
                                            {product.condition === "NEW"
                                                ? "Baru"
                                                : product.condition_rating
                                                    ? `${product.condition_rating}/10`
                                                    : "Preloved"
                                            }
                                        </span>
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="text-sm font-medium text-slate-900 line-clamp-2 mb-1 group-hover:text-brand-primary transition-colors">
                                        {product.title}
                                    </h3>
                                    <p className="text-base font-bold text-brand-primary">
                                        {formatPrice(product.price)}
                                    </p>
                                    {product.seller && (
                                        <p className="text-xs text-slate-500 mt-1 truncate">
                                            {product.seller.store_name || product.seller.name}
                                        </p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
