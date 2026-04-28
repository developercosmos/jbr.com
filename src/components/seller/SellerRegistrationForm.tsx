"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Store, MapPin, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { activateSellerProfile, checkStoreSlugAvailability } from "@/actions/seller";
import { normalizeStoreSlug } from "@/lib/seller";

interface AddressOption {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    full_address: string;
    is_default_pickup: boolean | null;
}

interface SellerRegistrationFormProps {
    addresses: AddressOption[];
    initialName: string;
    initialSlugAvailability: {
        available: boolean;
        normalized: string;
        reason: string | null;
    };
}

export function SellerRegistrationForm({ addresses, initialName, initialSlugAvailability }: SellerRegistrationFormProps) {
    const [isPending, startTransition] = useTransition();
    const [slugStatus, setSlugStatus] = useState<{ checking: boolean; available: boolean | null; message: string }>({
        checking: false,
        available: initialSlugAvailability.available,
        message: initialSlugAvailability.available
            ? "Slug tersedia."
            : (initialSlugAvailability.reason || "Slug belum tersedia."),
    });
    const [message, setMessage] = useState<string>("");
    const [formData, setFormData] = useState({
        storeName: initialName ? `${initialName} Store` : "",
        storeSlug: initialName ? normalizeStoreSlug(`${initialName} Store`) : "",
        pickupAddressId: addresses.find((address) => address.is_default_pickup)?.id || addresses[0]?.id || "",
        payoutBankName: "",
        storeDescription: "",
    });

    const runSlugAvailabilityCheck = (nextSlug: string) => {
        if (nextSlug.length < 3) {
            setSlugStatus({ checking: false, available: null, message: "Slug minimal 3 karakter." });
            return;
        }

        setSlugStatus({ checking: true, available: null, message: "Memeriksa slug..." });

        startTransition(async () => {
            try {
                const result = await checkStoreSlugAvailability(nextSlug);
                setSlugStatus({
                    checking: false,
                    available: result.available,
                    message: result.available ? "Slug tersedia." : (result.reason || "Slug tidak tersedia."),
                });
            } catch {
                setSlugStatus({ checking: false, available: false, message: "Gagal memeriksa slug." });
            }
        });
    };

    const handleSubmit = () => {
        setMessage("");

        // Client-side guards so the user gets immediate feedback instead of
        // having to round-trip to the server only to be told a required field
        // is empty.
        if (formData.storeName.trim().length < 3) {
            setMessage("Nama Toko minimal 3 karakter.");
            return;
        }
        if (!formData.pickupAddressId) {
            setMessage("Pilih alamat pickup terlebih dahulu.");
            return;
        }
        if (formData.payoutBankName.trim().length < 2) {
            setMessage("Bank Payout wajib diisi (mis. BCA a.n. Nama Anda).");
            return;
        }

        startTransition(async () => {
            try {
                const result = await activateSellerProfile(formData);
                if (result.success) {
                    // Hard-navigate so the user doesn't sit watching the
                    // spinner while React waits for the destination page to
                    // stream in. The destination page will load with its own
                    // skeleton/loader.
                    window.location.assign(result.redirectTo);
                } else {
                    setMessage(result.error || "Gagal mengaktifkan akun seller.");
                }
            } catch (error) {
                setMessage(error instanceof Error ? error.message : "Gagal mengaktifkan akun seller.");
            }
        });
    };

    const hasAddresses = addresses.length > 0;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">
                    Aktivasi Seller Center
                </h1>
                <p className="mt-2 text-slate-500">
                    Lengkapi profil toko Anda untuk mulai jualan. Status awal akan masuk T0 dan tetap bisa mulai publish produk.
                </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-brand-primary" />
                    <p>
                        Aktivasi ini membuat toko Anda aktif di Seller Center. Review admin tetap berjalan di belakang layar untuk kontrol kualitas.
                    </p>
                </div>

                {message && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {message}
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Store className="h-4 w-4 text-brand-primary" />
                            Nama Toko
                        </label>
                        <input
                            type="text"
                            value={formData.storeName}
                            onChange={(event) => {
                                const nextStoreName = event.target.value;
                                const nextSlug = normalizeStoreSlug(nextStoreName);
                                setFormData((current) => ({ ...current, storeName: nextStoreName, storeSlug: nextSlug }));
                                runSlugAvailabilityCheck(nextSlug);
                            }}
                            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="Contoh: Smash Point Jakarta"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Slug Toko</label>
                        <input
                            type="text"
                            value={formData.storeSlug}
                            onChange={(event) => {
                                const nextSlug = normalizeStoreSlug(event.target.value);
                                setFormData((current) => ({ ...current, storeSlug: nextSlug }));
                                runSlugAvailabilityCheck(nextSlug);
                            }}
                            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="smash-point-jakarta"
                        />
                        <p className={`text-sm ${slugStatus.available ? "text-green-600" : slugStatus.available === false ? "text-red-600" : "text-slate-500"}`}>
                            {slugStatus.message}
                        </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <MapPin className="h-4 w-4 text-brand-primary" />
                            Alamat Pickup
                        </label>
                        {!hasAddresses ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                                Tambahkan alamat lebih dulu di <Link href="/profile/address" className="font-semibold underline">buku alamat</Link> sebelum mengaktifkan toko.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {addresses.map((address) => (
                                    <label
                                        key={address.id}
                                        className={`block rounded-xl border p-4 cursor-pointer ${formData.pickupAddressId === address.id ? "border-brand-primary bg-brand-primary/5" : "border-slate-200 bg-white"}`}
                                    >
                                        <input
                                            type="radio"
                                            name="pickupAddress"
                                            value={address.id}
                                            checked={formData.pickupAddressId === address.id}
                                            onChange={() => setFormData((current) => ({ ...current, pickupAddressId: address.id }))}
                                            className="sr-only"
                                        />
                                        <p className="font-semibold text-slate-900">
                                            {address.label} ({address.recipient_name})
                                        </p>
                                        <p className="mt-1 text-sm text-slate-600">{address.phone}</p>
                                        <p className="mt-1 text-sm text-slate-500">{address.full_address}</p>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <Landmark className="h-4 w-4 text-brand-primary" />
                            Bank Payout <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.payoutBankName}
                            onChange={(event) => setFormData((current) => ({ ...current, payoutBankName: event.target.value }))}
                            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="Contoh: BCA a.n. Nama Anda"
                            required
                            minLength={2}
                        />
                        <p className="text-sm text-slate-500">
                            Cukup tulis bank dan nama pemilik (mis. BCA a.n. Budi Santoso). Untuk membuka batas
                            transaksi yang lebih besar, ajukan{" "}
                            <Link href="/seller/settings#kyc" className="text-brand-primary hover:underline font-medium">
                                verifikasi KYC tier 1 atau 2
                            </Link>{" "}
                            di pengaturan toko setelah aktivasi.
                        </p>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium text-slate-700">Deskripsi Singkat Toko</label>
                        <textarea
                            rows={4}
                            value={formData.storeDescription}
                            onChange={(event) => setFormData((current) => ({ ...current, storeDescription: event.target.value }))}
                            className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                            placeholder="Ceritakan spesialisasi toko Anda..."
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                    <Link href="/profile/address" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        Kelola Alamat
                    </Link>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isPending || !hasAddresses || !slugStatus.available}
                        className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:bg-slate-400"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Aktifkan Seller
                    </button>
                </div>
            </div>
        </div>
    );
}
