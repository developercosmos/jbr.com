import { getCategoryBySlug } from "@/actions/categories";
import { getFilteredProducts, getProductCount } from "@/actions/products";
import { BrowsePageLayout } from "@/components/browse/BrowsePageLayout";
import { notFound } from "next/navigation";

interface CategoryPageProps {
    params: Promise<{ slug: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
    const { slug } = await params;

    // Get category from database
    const category = await getCategoryBySlug(slug);

    // If category not found, show 404 or fallback to formatted slug
    const categoryName = category
        ? category.name
        : slug
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");

    const filters = { categorySlug: slug, limit: 48 };

    const [products, productCount] = await Promise.all([
        getFilteredProducts(filters),
        getProductCount(filters),
    ]);

    return (
        <BrowsePageLayout
            title={categoryName}
            subtitle={category ? undefined : "Kategori ini belum terdaftar di sistem"}
            breadcrumbItems={[
                { label: "Beranda", href: "/" },
                { label: "Kategori", href: "/equipment" },
                { label: categoryName },
            ]}
            products={products}
            productCount={productCount}
            emptyMessage={`Belum ada produk dalam kategori ${categoryName}`}
        />
    );
}
