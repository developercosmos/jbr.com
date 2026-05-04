"use client";

import { useState, useTransition, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
    Save,
    Upload,
    Store,
    MapPin,
    Wallet,
    Image as ImageIcon,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Camera,
    PencilLine,
    ExternalLink,
} from "lucide-react";
import {
    updateSellerProfile,
    resubmitSellerActivationReview,
    uploadSellerBanner,
    uploadSellerLogo,
} from "@/actions/seller";

type SellerProfile = {
    id: string;
    name: string;
    email: string;
    image: string | null;
    store_name: string | null;
    store_slug: string | null;
    store_description: string | null;
    store_tagline: string | null;
    store_banner_url: string | null;
    payout_bank_name: string | null;
    tier: "T0" | "T1" | "T2";
};

type AddressOption = {
    id: string;
    label: string;
    recipient_name: string;
    full_address: string;
    postal_code: string | null;
    is_default_pickup: boolean;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function StoreSettingsForm({
    profile,
    addresses,
    storeUrl,
    storeStatus,
    storeReviewNotes,
}: {
    profile: SellerProfile;
    addresses: AddressOption[];
    storeUrl: string;
    storeStatus: "ACTIVE" | "PENDING_REVIEW" | "VACATION" | "BANNED" | null;
    storeReviewNotes: string | null;
}) {
    const router = useRouter();
    const [bannerUrl, setBannerUrl] = useState<string | null>(profile.store_banner_url);
    const [logoUrl, setLogoUrl] = useState<string | null>(profile.image);
    const [bannerUploading, setBannerUploading] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);

    const [storeName, setStoreName] = useState(profile.store_name ?? "");
    const [tagline, setTagline] = useState(profile.store_tagline ?? "");
    const [description, setDescription] = useState(profile.store_description ?? "");
    const [bankName, setBankName] = useState(profile.payout_bank_name ?? "");
    const [pickupAddressId, setPickupAddressId] = useState<string>(
        addresses.find((a) => a.is_default_pickup)?.id ?? addresses[0]?.id ?? "",
    );

    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [toast, setToast] = useState<Toast>(null);
    const [isPending, startTransition] = useTransition();

    const bannerInput = useRef<HTMLInputElement>(null);
    const logoInput = useRef<HTMLInputElement>(null);

    const showToast = (t: Toast) => {
        setToast(t);
        if (t) setTimeout(() => setToast(null), 4000);
    };

    const handleBannerChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await uploadSellerBanner(fd);
            if (res.success) {
                setBannerUrl(res.url);
                showToast({ type: "success", message: "Banner toko berhasil diunggah" });
            } else {
                showToast({ type: "error", message: res.error });
            }
        } catch {
            showToast({ type: "error", message: "Upload gagal. Coba lagi." });
        } finally {
            setBannerUploading(false);
            if (bannerInput.current) bannerInput.current.value = "";
        }
    };

    const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await uploadSellerLogo(fd);
            if (res.success) {
                setLogoUrl(res.url);
                showToast({ type: "success", message: "Logo berhasil diunggah" });
            } else {
                showToast({ type: "error", message: res.error });
            }
        } catch {
            showToast({ type: "error", message: "Upload gagal. Coba lagi." });
        } finally {
            setLogoUploading(false);
            if (logoInput.current) logoInput.current.value = "";
        }
    };

    const handleSave = () => {
        setFieldErrors({});
        // client-side guards
        if (storeName.trim().length < 3) {
            setFieldErrors({ storeName: "Nama toko minimal 3 karakter" });
            showToast({ type: "error", message: "Periksa kembali isian Anda" });
            return;
        }
        if (bankName.trim().length < 2) {
            setFieldErrors({ payoutBankName: "Bank payout wajib diisi" });
            showToast({ type: "error", message: "Periksa kembali isian Anda" });
            return;
        }

        startTransition(async () => {
            const res = await updateSellerProfile({
                storeName: storeName.trim(),
                storeTagline: tagline.trim() || null,
                storeDescription: description.trim() || null,
                payoutBankName: bankName.trim(),
                pickupAddressId: pickupAddressId || null,
            });
            if (res.success) {
                showToast({ type: "success", message: "Perubahan tersimpan" });
                // Refresh server components to show updated data
                router.refresh();
            } else {
                setFieldErrors(res.fieldErrors ?? {});
                showToast({ type: "error", message: res.error });
            }
        });
    };

    const handleResubmitReview = () => {
        startTransition(async () => {
            try {
                const res = await resubmitSellerActivationReview();
                if (res.success) {
                    showToast({ type: "success", message: "Pengajuan review ulang berhasil dikirim" });
                    router.refresh();
                }
            } catch (error) {
                showToast({
                    type: "error",
                    message: error instanceof Error ? error.message : "Gagal mengajukan review ulang",
                });
            }
        });
    };

    const initials = (profile.store_name || profile.name || "??").slice(0, 2).toUpperCase();
    const selectedAddress = addresses.find((a) => a.id === pickupAddressId);

    return (
        <div className="space-y-8">
            {storeStatus === "PENDING_REVIEW" && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Pengajuan aktivasi seller Anda sedang direview admin. Anda akan menerima notifikasi setelah keputusan dibuat.
                </div>
            )}

            {storeStatus === "VACATION" && storeReviewNotes && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 space-y-3 text-sm text-rose-900">
                    <div>
                        <div className="font-semibold mb-1">Pengajuan seller perlu revisi</div>
                        <div>{storeReviewNotes}</div>
                    </div>
                    <button
                        type="button"
                        onClick={handleResubmitReview}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Ajukan Review Ulang
                    </button>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${
                        toast.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                            : "bg-red-50 border border-red-200 text-red-800"
                    }`}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5" />
                    ) : (
                        <AlertCircle className="w-5 h-5" />
                    )}
                    <span className="text-sm font-medium">{toast.message}</span>
                </div>
            )}

            {/* Branding Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-brand-primary" />
                        Branding Toko
                    </h2>
                    <span className="text-xs text-slate-500">JPG / PNG / WEBP — maks 5 MB</span>
                </header>

                <div className="p-6">
                    {/* Banner */}
                    <div
                        className="relative h-44 sm:h-52 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden cursor-pointer group"
                        onClick={() => !bannerUploading && bannerInput.current?.click()}
                    >
                        {bannerUrl ? (
                            <Image
                                src={bannerUrl}
                                alt="Banner toko"
                                fill
                                sizes="(max-width: 768px) 100vw, 800px"
                                className="object-cover"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                                <Upload className="w-8 h-8" />
                                <span className="text-sm font-medium">
                                    Klik untuk upload banner
                                </span>
                                <span className="text-xs text-slate-400">
                                    Rekomendasi 1600 × 400 px
                                </span>
                            </div>
                        )}
                        {bannerUrl && (
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white font-medium flex items-center gap-2">
                                    <Camera className="w-5 h-5" /> Ganti banner
                                </span>
                            </div>
                        )}
                        {bannerUploading && (
                            <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                            </div>
                        )}
                        <input
                            ref={bannerInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleBannerChange}
                        />
                    </div>

                    {/* Logo */}
                    <div className="-mt-12 ml-6 relative inline-block">
                        <div
                            className="h-24 w-24 rounded-full border-4 border-white bg-brand-primary/10 overflow-hidden cursor-pointer group/logo flex items-center justify-center shadow-md"
                            onClick={() => !logoUploading && logoInput.current?.click()}
                        >
                            {logoUrl ? (
                                <Image src={logoUrl} alt="Logo toko" fill className="object-cover" sizes="96px" />
                            ) : (
                                <span className="text-2xl font-bold text-brand-primary">{initials}</span>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="w-5 h-5 text-white" />
                            </div>
                            {logoUploading && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                                </div>
                            )}
                        </div>
                        <input
                            ref={logoInput}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="hidden"
                            onChange={handleLogoChange}
                        />
                    </div>
                    <p className="mt-4 ml-6 text-xs text-slate-500">
                        Logo akan tampil di kartu produk dan halaman toko publik. Upload langsung tersimpan otomatis.
                    </p>
                </div>
            </section>

            {/* Profile Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Store className="w-5 h-5 text-brand-primary" />
                        Profil Toko
                    </h2>
                    {profile.store_slug && (
                        <Link
                            href={storeUrl}
                            target="_blank"
                            className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                        >
                            Lihat halaman publik <ExternalLink className="w-3 h-3" />
                        </Link>
                    )}
                </header>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Nama Toko" required error={fieldErrors.storeName}>
                        <input
                            type="text"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            maxLength={80}
                            placeholder="Contoh: Badminton Pro Shop"
                            className={inputClass(!!fieldErrors.storeName)}
                        />
                    </Field>

                    <Field label="URL Toko">
                        <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600">
                            <span className="text-slate-400">jualbeliraket.com/</span>
                            <span className="font-mono font-medium">{profile.store_slug}</span>
                            <PencilLine className="w-3.5 h-3.5 text-slate-300 ml-auto" />
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Slug toko tidak dapat diubah setelah aktivasi.
                        </p>
                    </Field>

                    <Field label="Slogan / Tagline" hint={`${tagline.length}/120`}>
                        <input
                            type="text"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            maxLength={120}
                            placeholder="Best Gear for Best Player"
                            className={inputClass(false)}
                        />
                    </Field>

                    <Field label="Tier Saat Ini">
                        <div className="px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-700 flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-primary/10 text-brand-primary font-bold text-xs">
                                {profile.tier}
                            </span>
                            <span className="text-slate-500">
                                Limit{" "}
                                {profile.tier === "T0"
                                    ? "Rp 10jt/bln"
                                    : profile.tier === "T1"
                                      ? "Rp 50jt/bln"
                                      : "Rp 250jt/bln"}
                            </span>
                        </div>
                    </Field>

                    <div className="md:col-span-2">
                        <Field
                            label="Deskripsi Toko"
                            hint={`${description.length}/600`}
                        >
                            <textarea
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={600}
                                placeholder="Ceritakan tentang toko, jenis produk, dan keunggulan Anda…"
                                className={`${inputClass(false)} resize-y`}
                            />
                        </Field>
                    </div>
                </div>
            </section>

            {/* Pickup Address Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-brand-primary" />
                        Alamat Pickup
                    </h2>
                    <Link
                        href="/profile/address"
                        className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                    >
                        Kelola alamat <ExternalLink className="w-3 h-3" />
                    </Link>
                </header>

                <div className="p-6 space-y-4">
                    {addresses.length === 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            Anda belum memiliki alamat. Tambahkan alamat di{" "}
                            <Link href="/profile/address" className="font-bold underline">
                                halaman alamat
                            </Link>{" "}
                            untuk dipilih sebagai lokasi pickup.
                        </div>
                    ) : (
                        <>
                            <Field
                                label="Pilih alamat pickup"
                                error={fieldErrors.pickupAddressId}
                            >
                                <select
                                    value={pickupAddressId}
                                    onChange={(e) => setPickupAddressId(e.target.value)}
                                    className={inputClass(!!fieldErrors.pickupAddressId)}
                                >
                                    {addresses.map((a) => (
                                        <option key={a.id} value={a.id}>
                                            {a.label} — {a.recipient_name}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            {selectedAddress && (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                                    <p className="font-medium text-slate-900">
                                        {selectedAddress.recipient_name}
                                    </p>
                                    <p className="text-slate-600 mt-1">
                                        {selectedAddress.full_address}
                                        {selectedAddress.postal_code
                                            ? `, ${selectedAddress.postal_code}`
                                            : ""}
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </section>

            {/* Payout Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <header className="px-6 py-4 border-b border-slate-200">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-brand-primary" />
                        Payout
                    </h2>
                </header>
                <div className="p-6">
                    <Field
                        label="Bank Payout"
                        required
                        hint="Nama bank yang menerima settlement (contoh: BCA — 1234567890 a.n. Nama)"
                        error={fieldErrors.payoutBankName}
                    >
                        <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            maxLength={80}
                            className={inputClass(!!fieldErrors.payoutBankName)}
                            placeholder="BCA — 1234567890 a.n. John Doe"
                        />
                    </Field>
                </div>
            </section>

            {/* Save bar */}
            <div className="sticky bottom-4 flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all active:scale-[0.98]"
                >
                    {isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Save className="w-5 h-5" />
                    )}
                    {isPending ? "Menyimpan…" : "Simpan Perubahan"}
                </button>
            </div>
        </div>
    );
}

function inputClass(hasError: boolean) {
    return `block w-full px-3 py-2 border rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 sm:text-sm ${
        hasError
            ? "border-red-300 focus:ring-red-400"
            : "border-slate-200 focus:ring-brand-primary"
    }`;
}

function Field({
    label,
    children,
    required,
    hint,
    error,
}: {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    hint?: string;
    error?: string;
}) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                    {label}
                    {required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {hint && !error && <span className="text-xs text-slate-400">{hint}</span>}
            </div>
            {children}
            {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {error}
                </p>
            )}
        </div>
    );
}
