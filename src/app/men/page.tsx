import { getFilteredProducts, getProductCount } from "@/actions/products";
import { BrowsePageLayout } from "@/components/browse/BrowsePageLayout";

export default async function MenPage() {
    const filters = { gender: "MEN" as const, includeUnisex: true, limit: 48 };

    const [products, productCount] = await Promise.all([
        getFilteredProducts(filters),
        getProductCount(filters),
    ]);

    return (
        <BrowsePageLayout
            title="Men"
            subtitle="Perlengkapan badminton untuk pria"
            breadcrumbItems={[
                { label: "Beranda", href: "/" },
                { label: "Men" },
            ]}
            products={products}
            productCount={productCount}
            emptyMessage="Belum ada produk pria tersedia"
        />
    );
}
