import { getFilteredProducts, getProductCount } from "@/actions/products";
import { BrowsePageLayout } from "@/components/browse/BrowsePageLayout";

interface BrandPageProps {
    params: Promise<{ slug: string }>;
}

export default async function BrandPage({ params }: BrandPageProps) {
    const { slug } = await params;

    // Convert slug back to brand name (e.g., "yonex" -> "Yonex", "li-ning" -> "Li Ning")
    const brandName = slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    const filters = { brand: brandName, limit: 48 };

    const [products, productCount] = await Promise.all([
        getFilteredProducts(filters),
        getProductCount(filters),
    ]);

    return (
        <BrowsePageLayout
            title={brandName}
            subtitle={`Produk dari brand ${brandName}`}
            breadcrumbItems={[
                { label: "Beranda", href: "/" },
                { label: "Brands", href: "/brands" },
                { label: brandName },
            ]}
            products={products}
            productCount={productCount}
            emptyMessage={`Belum ada produk ${brandName}`}
        />
    );
}
