import { getUserAddresses } from "@/actions/address";
import { getSellerTierCaps, getT0Gates } from "@/actions/kyc";
import { checkStoreSlugAvailability, getSellerProfileByUserId } from "@/actions/seller";
import { normalizeStoreSlug } from "@/lib/seller";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SellerRegistrationForm } from "@/components/seller/SellerRegistrationForm";

export default async function SellerRegisterPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login?redirect=/seller/register");
    }

    const sellerProfile = await getSellerProfileByUserId(session.user.id);
    if (sellerProfile?.store_name && sellerProfile?.store_slug) {
        redirect("/seller");
    }

    const addresses = await getUserAddresses();
    const tierCaps = await getSellerTierCaps().catch(() => null);
    const t0Gates = await getT0Gates().catch(() => null);
    const initialName = session.user.name || "";
    const initialSlug = initialName ? normalizeStoreSlug(`${initialName} Store`) : "";
    const initialSlugAvailability = initialSlug.length >= 3
        ? await checkStoreSlugAvailability(initialSlug)
        : { available: false, normalized: initialSlug, reason: "Slug minimal 3 karakter." };

    return (
        <SellerRegistrationForm
            addresses={addresses.map((address) => ({
                id: address.id,
                label: address.label,
                recipient_name: address.recipient_name,
                phone: address.phone,
                full_address: address.full_address,
                is_default_pickup: address.is_default_pickup,
            }))}
            initialName={initialName}
            initialSlugAvailability={initialSlugAvailability}
            t0CapLabel={tierCaps ? `Rp ${tierCaps.T0.toLocaleString("id-ID")}` : "Rp 10.000.000"}
            t0MaxPriceLabel={t0Gates ? `Rp ${t0Gates.maxProductPrice.toLocaleString("id-ID")}` : "Rp 1.000.000"}
        />
    );
}
