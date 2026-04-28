import { PartyPopper } from "lucide-react";
import { getSellerProfileByUserId } from "@/actions/seller";
import { getUserAddresses } from "@/actions/address";
import { canAccessSellerCenter } from "@/lib/seller";
import { getCurrentSellerKyc } from "@/actions/kyc";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import KycSection from "./KycSection";
import StoreSettingsForm from "./StoreSettingsForm";

interface PageProps {
    searchParams: Promise<{ welcome?: string }>;
}

export default async function SellerSettingsPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const isWelcome = params.welcome === "1";

    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = session.user;
    const sellerProfile = await getSellerProfileByUserId(user.id);

    if (!sellerProfile?.store_name || !sellerProfile.store_slug || !canAccessSellerCenter(sellerProfile.store_status)) {
        redirect("/seller/register");
    }

    const [kycProfile, addressList] = await Promise.all([
        getCurrentSellerKyc(),
        getUserAddresses(),
    ]);

    const currentTier = (sellerProfile.tier ?? "T0") as "T0" | "T1" | "T2";

    const addressesForForm = addressList.map((a) => ({
        id: a.id,
        label: a.label,
        recipient_name: a.recipient_name,
        full_address: a.full_address,
        postal_code: a.postal_code,
        is_default_pickup: a.is_default_pickup ?? false,
    }));

    return (
        <div className="flex-1 p-6 sm:p-8 scroll-smooth bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 mb-1 uppercase">
                        Pengaturan Toko
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Kelola branding, alamat pickup, dan informasi payout toko Anda.
                    </p>
                </div>

                {isWelcome && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
                        <PartyPopper className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                        <div className="space-y-1">
                            <h3 className="font-bold text-emerald-900">
                                Toko Anda berhasil diaktifkan!
                            </h3>
                            <p className="text-sm text-emerald-700">
                                Status awal: <strong>{currentTier}</strong> dengan limit transaksi bulanan{" "}
                                {currentTier === "T0"
                                    ? "Rp 10.000.000"
                                    : currentTier === "T1"
                                      ? "Rp 50.000.000"
                                      : "Rp 250.000.000"}
                                . Untuk membuka limit lebih besar dan lencana verifikasi, ajukan KYC tier 1
                                (KTP + selfie) atau tier 2 (+ dokumen bisnis) di bagian bawah halaman ini.
                            </p>
                        </div>
                    </div>
                )}

                <StoreSettingsForm
                    profile={{
                        id: sellerProfile.id,
                        name: sellerProfile.name,
                        email: sellerProfile.email,
                        image: sellerProfile.image ?? null,
                        store_name: sellerProfile.store_name,
                        store_slug: sellerProfile.store_slug,
                        store_description: sellerProfile.store_description,
                        store_tagline: sellerProfile.store_tagline ?? null,
                        store_banner_url: sellerProfile.store_banner_url ?? null,
                        payout_bank_name: sellerProfile.payout_bank_name,
                        tier: currentTier,
                    }}
                    addresses={addressesForForm}
                    storeUrl={`/store/${sellerProfile.store_slug}`}
                />

                {/* KYC Section */}
                <KycSection
                    profile={kycProfile ? {
                        tier: kycProfile.tier,
                        status: kycProfile.status,
                        notes: kycProfile.notes,
                        submitted_at: kycProfile.submitted_at,
                        reviewed_at: kycProfile.reviewed_at,
                        ktp_file_id: kycProfile.ktp_file_id,
                        selfie_file_id: kycProfile.selfie_file_id,
                        business_doc_file_id: kycProfile.business_doc_file_id,
                    } : null}
                    currentTier={currentTier}
                />
            </div>
        </div>
    );
}
