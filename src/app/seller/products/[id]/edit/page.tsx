import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { getSellerProductById, getBrands } from "@/actions/products";
import { getCategories } from "@/actions/categories";
import { EditProductForm } from "./EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login");

    const sellerProfile = await getSellerProfileByUserId(session.user.id);
    if (!sellerProfile?.store_name || !sellerProfile.store_slug || !canAccessSellerCenter(sellerProfile.store_status)) {
        redirect("/seller/register");
    }

    const product = await getSellerProductById(id);
    if (!product) notFound();

    let categories: { id: string; name: string; slug: string }[] = [];
    try {
        const cats = await getCategories();
        categories = cats.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
    } catch { /* fallback to empty */ }

    let brands: string[] = [];
    try {
        const brandsData = await getBrands();
        brands = brandsData.map((b) => b.name);
    } catch { /* fallback to empty */ }

    return (
        <EditProductForm
            product={{
                id: product.id,
                title: product.title,
                description: product.description,
                brand: product.brand,
                gender: (product.gender ?? "UNISEX") as "UNISEX" | "MEN" | "WOMEN",
                price: product.price,
                condition: product.condition as "NEW" | "PRELOVED",
                condition_rating: product.condition_rating,
                weight_grams: product.weight_grams,
                stock: product.stock,
                category_id: product.category_id,
                images: (product.images ?? []) as string[],
                status: product.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "MODERATED",
            }}
            categories={categories}
            brands={brands}
        />
    );
}
