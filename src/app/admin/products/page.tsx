import { Eye, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getAdminProducts, getAdminCategories } from "@/actions/admin";
import { ProductActions } from "./ProductActions";
import { ProductFilters } from "./ProductFilters";

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

const statusConfig: Record<string, { label: string; dotColor: string; bgColor: string; textColor: string }> = {
    DRAFT: {
        label: "Review",
        dotColor: "bg-yellow-500 animate-pulse",
        bgColor: "bg-yellow-50 dark:bg-yellow-500/10",
        textColor: "text-yellow-700 dark:text-yellow-400"
    },
    PUBLISHED: {
        label: "Active",
        dotColor: "bg-green-500",
        bgColor: "bg-green-50 dark:bg-green-500/10",
        textColor: "text-green-700 dark:text-green-400"
    },
    ARCHIVED: {
        label: "Archived",
        dotColor: "bg-slate-400",
        bgColor: "bg-slate-100 dark:bg-slate-700",
        textColor: "text-slate-600 dark:text-slate-400"
    },
    MODERATED: {
        label: "Moderated",
        dotColor: "bg-red-500",
        bgColor: "bg-red-50 dark:bg-red-500/10",
        textColor: "text-red-700 dark:text-red-400"
    },
};

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const search = typeof params.search === "string" ? params.search : undefined;
    const status = typeof params.status === "string" ? params.status : undefined;
    const categoryId = typeof params.category === "string" ? params.category : undefined;

    const [products, categories] = await Promise.all([
        getAdminProducts({ search, status, categoryId }),
        getAdminCategories(),
    ]);

    return (
        <>
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none dark:from-white/5 dark:to-transparent"></div>
            <div className="container mx-auto max-w-[1600px] p-6 lg:p-10 flex flex-col gap-8 relative z-0">
                {/* Header */}
                <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div>
                        <nav aria-label="Breadcrumb" className="flex mb-3">
                            <ol className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
                                <li>
                                    <Link
                                        href="/admin"
                                        className="hover:text-brand-primary transition-colors"
                                    >
                                        Dashboard
                                    </Link>
                                </li>
                                <li>
                                    <span className="text-slate-300 dark:text-slate-600">/</span>
                                </li>
                                <li>
                                    <span className="font-medium text-brand-primary">
                                        Products
                                    </span>
                                </li>
                            </ol>
                        </nav>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                            Product Inventory
                        </h1>
                        <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">
                            Manage all products registered on the platform.
                        </p>
                    </div>
                </div>

                {/* Filters & Search */}
                <ProductFilters categories={categories} />

                {/* Products Table */}
                <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                    {products.length === 0 ? (
                        <div className="text-center py-16">
                            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Tidak ada produk
                            </h3>
                            <p className="text-slate-500">
                                {search || status || categoryId
                                    ? "Tidak ada produk yang cocok dengan filter."
                                    : "Belum ada produk terdaftar di platform."}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 font-heading">
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Seller</th>
                                        <th className="px-6 py-4">Category</th>
                                        <th className="px-6 py-4 text-right">Price</th>
                                        <th className="px-6 py-4 text-center">Stock</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {products.map((product) => {
                                        const statusStyle = statusConfig[product.status] || statusConfig.DRAFT;
                                        const images = product.images as string[] | null;

                                        return (
                                            <tr key={product.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-12 rounded-xl bg-slate-200 dark:bg-slate-700 relative overflow-hidden flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                            {images && images.length > 0 ? (
                                                                <Image
                                                                    src={images[0]}
                                                                    alt={product.title}
                                                                    fill
                                                                    className="object-cover"
                                                                />
                                                            ) : (
                                                                <div className="w-full h-full flex items-center justify-center">
                                                                    <Package className="w-5 h-5 text-slate-400" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[200px]">
                                                                {product.title}
                                                            </span>
                                                            <span className="text-xs text-slate-500 font-mono">
                                                                ID: {product.id.slice(0, 8)}...
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5 text-sm text-slate-600 dark:text-slate-300">
                                                    {product.seller?.store_name || product.seller?.name || "-"}
                                                </td>
                                                <td className="px-6 py-5 text-sm">
                                                    <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-white/10 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                        {product.category?.name || "Uncategorized"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-bold text-right text-slate-900 dark:text-white font-heading">
                                                    {formatPrice(product.price)}
                                                </td>
                                                <td className="px-6 py-5 text-sm text-center text-slate-600 dark:text-slate-300">
                                                    <span className={product.stock <= 0 ? "text-red-500 font-bold" : ""}>
                                                        {product.stock}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle.bgColor} ${statusStyle.textColor} ring-1 ring-inset ring-current/20`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dotColor}`}></span>
                                                        {statusStyle.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-center">
                                                    <ProductActions
                                                        productId={product.id}
                                                        productSlug={product.slug}
                                                        status={product.status}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Results count */}
                {products.length > 0 && (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        Menampilkan {products.length} produk
                    </div>
                )}
            </div>
        </>
    );
}
