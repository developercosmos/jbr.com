import { Save, Upload, MapPin, Store, PartyPopper } from "lucide-react";
import Image from "next/image";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { getCurrentSellerKyc } from "@/actions/kyc";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import KycSection from "./KycSection";

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

    const kycProfile = await getCurrentSellerKyc();
    const currentTier = (sellerProfile.tier ?? "T0") as "T0" | "T1" | "T2";

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Pengaturan Toko
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Kelola informasi toko, branding, dan alamat pengiriman.
                    </p>
                </div>

                {isWelcome && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/20 p-5 flex items-start gap-3">
                        <PartyPopper className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                        <div className="space-y-1">
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-100">
                                Toko Anda berhasil diaktifkan!
                            </h3>
                            <p className="text-sm text-emerald-700 dark:text-emerald-200">
                                Status awal: <strong>{currentTier}</strong> dengan limit transaksi bulanan{" "}
                                {currentTier === "T0" ? "Rp 10.000.000" : currentTier === "T1" ? "Rp 50.000.000" : "Rp 250.000.000"}.
                                Untuk membuka limit lebih besar dan mendapat lencana verifikasi, ajukan KYC tier 1 (KTP + selfie)
                                atau tier 2 (+ dokumen bisnis) di section di bawah ini.
                            </p>
                        </div>
                    </div>
                )}

                {/* Store Profile Section */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Store className="w-5 h-5 text-brand-primary" />
                            Profil Toko
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Banner & Logo */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Branding Toko
                            </label>
                            <div className="relative h-48 rounded-xl bg-slate-100 dark:bg-black/20 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group overflow-hidden">
                                <div className="relative z-10 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Upload className="w-8 h-8" />
                                    <span className="text-sm font-medium">Klik untuk upload banner</span>
                                </div>
                                {/* Logo Overlay */}
                                <div className="absolute -bottom-6 left-6">
                                    <div className="h-24 w-24 rounded-full border-4 border-white dark:border-surface-dark bg-brand-primary/10 overflow-hidden relative group/logo cursor-pointer flex items-center justify-center">
                                        {user.image ? (
                                            <Image
                                                src={user.image}
                                                alt="Store Logo"
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <span className="text-2xl font-bold text-brand-primary">
                                                {(user.name || "").slice(0, 2).toUpperCase() || "??"}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                                            <Upload className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nama Toko
                                </label>
                                <input
                                    type="text"
                                    defaultValue={user.name || ""}
                                    placeholder="Masukkan nama toko"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Slogan / Tagline
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Best Gear for Best Player"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Deskripsi Toko
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Jelaskan tentang toko Anda..."
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address Section */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-brand-primary" />
                            Alamat & Pengiriman
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Alamat Lengkap
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Jl. Olahraga No. 123, Komplek Stadion Utama"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Kota / Kabupaten
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Jakarta Selatan, Bandung, Surabaya"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Kode Pos
                                </label>
                                <input
                                    type="text"
                                    placeholder="12345"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

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

                {/* Save Button */}
                <div className="flex justify-end">
                    <button className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all transform active:scale-[0.98]">
                        <Save className="w-5 h-5" />
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    );
}
