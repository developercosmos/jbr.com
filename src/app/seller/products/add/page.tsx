import { getCategories } from "@/actions/categories";
import { getUserAddresses } from "@/actions/address";
import { getBrands } from "@/actions/products";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AddProductForm } from "./AddProductForm";

export default async function AddProductPage() {
    // Verify seller is logged in
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    // Fetch categories from database
    const categories = await getCategories();

    // Fetch brands for dropdown
    const brandsData = await getBrands();
    const brands = brandsData.map(b => b.name);

    // Check if seller has pickup address
    type AddressType = Awaited<ReturnType<typeof getUserAddresses>>;
    let addresses: AddressType = [];
    try {
        addresses = await getUserAddresses();
    } catch {
        addresses = [];
    }

    const hasPickupAddress = addresses.some(
        (addr) => addr.is_default_pickup
    ) || addresses.length > 0;

    return (
        <AddProductForm
            categories={categories}
            brands={brands}
            hasPickupAddress={hasPickupAddress}
        />
    );
}
