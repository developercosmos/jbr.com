import { getFilteredProducts, getProductCount } from "@/actions/products";
import { BrowsePageLayout } from "@/components/browse/BrowsePageLayout";

export default async function FeedPage() {
    const [products, productCount] = await Promise.all([
        getFilteredProducts({ sortBy: "newest", limit: 48 }),
        getProductCount({}),
    ]);

    return (
        <BrowsePageLayout
            title="Feed"
            subtitle="Produk terbaru dari semua seller"
            breadcrumbItems={[
                { label: "Beranda", href: "/" },
                { label: "Feed" },
            ]}
            products={products}
            productCount={productCount}
            emptyMessage="Belum ada produk tersedia"
        />
    );
}
