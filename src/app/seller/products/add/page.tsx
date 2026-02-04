import { getCategories } from "@/actions/categories";
import { getUserAddresses } from "@/actions/address";
import { getBrands } from "@/actions/products";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AddProductForm } from "./AddProductForm";

export const dynamic = "force-dynamic";

export default async function AddProductPage() {
    // Verify seller is logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    // Fetch categories from database with error handling
    let categories: { id: string; name: string; slug: string }[] = [];
    try {
        const cats = await getCategories();
        categories = cats.map(c => ({ id: c.id, name: c.name, slug: c.slug }));
    } catch (err) {
        console.error("Error fetching categories:", err);
        categories = [];
    }

    // Fetch brands for dropdown with error handling
    let brands: string[] = [];
    try {
        const brandsData = await getBrands();
        brands = brandsData.map(b => b.name);
    } catch (err) {
        console.error("Error fetching brands:", err);
        brands = [];
    }

    // Check if seller has pickup address
    let hasPickupAddress = false;
    try {
        const addresses = await getUserAddresses();
        hasPickupAddress = addresses.some((addr) => addr.is_default_pickup) || addresses.length > 0;
    } catch (err) {
        console.error("Error fetching addresses:", err);
        hasPickupAddress = false;
    }

    return (
        <AddProductForm
            categories={categories}
            brands={brands}
            hasPickupAddress={hasPickupAddress}
        />
    );
}
