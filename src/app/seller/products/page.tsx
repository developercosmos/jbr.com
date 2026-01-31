import Link from "next/link";
import Image from "next/image";
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Package, AlertTriangle } from "lucide-react";
import { getSellerProducts } from "@/actions/products";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

function formatDate(date: Date) {
    return new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
    }).format(date);
}

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
    DRAFT: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-700 dark:text-slate-300" },
    PUBLISHED: { label: "Aktif", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
    ARCHIVED: { label: "Arsip", bg: "bg-slate-100 dark:bg-slate-700", text: "text-slate-500" },
    MODERATED: { label: "Dimoderasi", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
};

export default async function SellerProductsPage() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const products = await getSellerProducts();

    return (
        <>
            {/* Header */}
            <header className="h-20 flex items-center justify-between px-8 py-4 bg-white/50 dark:bg-background-dark/50 backdrop-blur-sm sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800/50">
                <div className="flex-1 max-w-xl">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-brand-primary transition-colors">
                            <Search className="w-5 h-5" />
                        </div>
                        <input
                            autoComplete="off"
                            className="block w-full pl-10 pr-3 py-2.5 border-none rounded-xl leading-5 bg-slate-100 dark:bg-surface-dark text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm transition-all"
                            placeholder="Cari produk..."
                            type="text"
                        />
                    </div>
                </div>
                <div className="ml-6">
                    <Link
                        href="/seller/products/add"
                        className="flex items-center gap-2 bg-brand-primary hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-brand-primary/25"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Tambah Produk</span>
                    </Link>
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                            Produk Saya
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400">
                            Kelola semua produk yang Anda jual.
                        </p>
                    </div>

                    {products.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                            <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Belum ada produk
                            </h3>
                            <p className="text-slate-500 mb-6">
                                Mulai jual produk pertama Anda.
                            </p>
                            <Link
                                href="/seller/products/add"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-primary text-white font-bold rounded-xl hover:bg-blue-600 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Tambah Produk
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-surface-dark rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                            <th className="px-6 py-4 font-semibold">Produk</th>
                                            <th className="px-6 py-4 font-semibold">Harga</th>
                                            <th className="px-6 py-4 font-semibold">Kondisi</th>
                                            <th className="px-6 py-4 font-semibold">Stok</th>
                                            <th className="px-6 py-4 font-semibold">Status</th>
                                            <th className="px-6 py-4 font-semibold">Dibuat</th>
                                            <th className="px-6 py-4 font-semibold text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                        {products.map((product) => {
                                            const status = statusConfig[product.status] || statusConfig.DRAFT;

                                            return (
                                                <tr key={product.id} className="group hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
                                                                {product.images && product.images.length > 0 ? (
                                                                    <Image
                                                                        src={product.images[0]}
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
                                                            <div className="min-w-0">
                                                                <p className="font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                                                                    {product.title}
                                                                </p>
                                                                <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                                                    {product.category?.name || "Tanpa Kategori"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">
                                                        {formatPrice(product.price)}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${product.condition === "NEW" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                                                            {product.condition === "NEW" ? "Baru" : `Pre-loved ${product.condition_rating || ""}/10`}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm">
                                                        <span className={product.stock <= 0 ? "text-red-500 font-bold" : "text-slate-600 dark:text-slate-300"}>
                                                            {product.stock <= 0 && <AlertTriangle className="inline w-4 h-4 mr-1" />}
                                                            {product.stock}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        {formatDate(product.created_at)}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Link
                                                                href={`/product/${product.slug}`}
                                                                className="p-2 text-slate-400 hover:text-brand-primary hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                                title="Lihat"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </Link>
                                                            <Link
                                                                href={`/seller/products/${product.id}/edit`}
                                                                className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                                title="Edit"
                                                            >
                                                                <Edit className="w-4 h-4" />
                                                            </Link>
                                                            <button
                                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
