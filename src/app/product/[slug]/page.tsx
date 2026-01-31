import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { SimilarProducts } from "@/components/product/SimilarProducts";
import { getProductBySlug } from "@/actions/products";

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) {
        notFound();
    }

    return (
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 lg:px-10 py-6">
            {/* Breadcrumbs */}
            <nav className="flex items-center text-sm text-slate-500 dark:text-slate-400 mb-6 overflow-x-auto whitespace-nowrap pb-2">
                <Link href="/" className="hover:text-brand-primary transition-colors">
                    Home
                </Link>
                <span className="mx-2 text-slate-400">/</span>
                {product.category && (
                    <>
                        <Link href={`/category/${product.category.slug}`} className="hover:text-brand-primary transition-colors">
                            {product.category.name}
                        </Link>
                        <span className="mx-2 text-slate-400">/</span>
                    </>
                )}
                <span className="text-slate-900 dark:text-white font-medium">
                    {product.title}
                </span>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                {/* Left Side: Gallery */}
                <div className="lg:col-span-7">
                    <ProductGallery images={product.images || []} />
                </div>

                {/* Right Side: Details & Actions */}
                <div className="lg:col-span-5">
                    <ProductInfo product={{
                        id: product.id,
                        title: product.title,
                        description: product.description,
                        price: product.price,
                        condition: product.condition,
                        condition_rating: product.condition_rating,
                        condition_notes: product.condition_notes,
                        stock: product.stock,
                        seller: product.seller,
                        category: product.category,
                    }} />
                </div>
            </div>

            {/* Similar Items Section */}
            <SimilarProducts />
        </main>
    );
}
