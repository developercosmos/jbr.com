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
                condition_checklist: (product.condition_checklist ?? []) as string[],
                weight_grams: product.weight_grams,
                stock: product.stock,
                bargain_enabled: Boolean(product.bargain_enabled),
                floor_price: product.floor_price,
                tiered_floor_price: (product.tiered_floor_price as Record<string, number> | null) ?? null,
                category_id: product.category_id,
                images: (product.images ?? []) as string[],
                status: product.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | "MODERATED",
                weight_class: product.weight_class,
                balance: product.balance,
                shaft_flex: product.shaft_flex,
                grip_size: product.grip_size,
                max_string_tension_lbs: product.max_string_tension_lbs,
                variants: (product.variants ?? [])
                    .slice()
                    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                    .map((v) => ({
                        name: v.name,
                        price: v.price != null ? String(Math.round(parseFloat(v.price))) : "",
                        stock: String(v.stock),
                        option1_name: v.option1_name ?? null,
                        option1_value: v.option1_value ?? null,
                        option2_name: v.option2_name ?? null,
                        option2_value: v.option2_value ?? null,
                        images: v.images ?? [],
                    })),
            }}
            categories={categories}
            brands={brands}
        />
    );
}
