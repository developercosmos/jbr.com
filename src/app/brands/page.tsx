import { getBrands } from "@/actions/products";
import Link from "next/link";
import { ChevronRight, Tag, Award } from "lucide-react";

export default async function BrandsPage() {
    const brands = await getBrands();

    return (
        <main className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumbs */}
                    <div className="flex flex-wrap gap-2 items-center mb-4 text-sm">
                        <Link href="/" className="text-slate-500 hover:text-brand-primary font-medium">
                            Beranda
                        </Link>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-900 font-medium">Brands</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase mb-2">
                        Brands
                    </h1>
                    <p className="text-slate-500">
                        Temukan produk dari brand favorit kamu
                    </p>
                </div>
            </div>

            {/* Brands Grid */}
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {brands.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {brands.map((brand) => (
                            <Link
                                key={brand.name}
                                href={`/brands/${encodeURIComponent(brand.name.toLowerCase().replace(/\s+/g, '-'))}`}
                                className="group bg-white rounded-xl p-6 border border-slate-200 hover:border-brand-primary hover:shadow-lg transition-all"
                            >
                                <div className="flex flex-col items-center text-center">
                                    <div className="w-16 h-16 mb-4 bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 rounded-full flex items-center justify-center group-hover:from-brand-primary/20 group-hover:to-brand-primary/10 transition-all">
                                        <Award className="w-8 h-8 text-brand-primary" />
                                    </div>
                                    <h3 className="font-bold text-slate-900 group-hover:text-brand-primary text-lg mb-1 transition-colors">
                                        {brand.name}
                                    </h3>
                                    <p className="text-sm text-slate-500">
                                        {brand.count} produk
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                        <Tag className="w-16 h-16 text-slate-300 mb-4" />
                        <h2 className="text-xl font-bold text-slate-700 mb-2">Belum Ada Brand</h2>
                        <p className="text-slate-500 mb-6 text-center max-w-md">
                            Brand akan muncul setelah seller menambahkan produk dengan info brand.
                        </p>
                        <Link
                            href="/"
                            className="px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl transition-colors"
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                )}
            </div>
        </main>
    );
}
