import { getFilteredProducts, getProductCount } from "@/actions/products";
import { BrowsePageLayout } from "@/components/browse/BrowsePageLayout";

export default async function WomenPage() {
    const filters = { gender: "WOMEN" as const, includeUnisex: true, limit: 48 };

    const [products, productCount] = await Promise.all([
        getFilteredProducts(filters),
        getProductCount(filters),
    ]);

    return (
        <BrowsePageLayout
            title="Women"
            subtitle="Perlengkapan badminton untuk wanita"
            breadcrumbItems={[
                { label: "Beranda", href: "/" },
                { label: "Women" },
            ]}
            products={products}
            productCount={productCount}
            emptyMessage="Belum ada produk wanita tersedia"
        />
    );
}
