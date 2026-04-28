"use client";

import { Plus, X, Loader2, MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { createAddress } from "@/actions/address";
import { MapLocationDialog } from "./MapLocationDialog";
import { AddressMapPreview } from "./AddressMapPreview";

export function AddAddressButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const [formData, setFormData] = useState({
        label: "",
        recipient_name: "",
        phone: "",
        full_address: "",
        postal_code: "",
        latitude: "",
        longitude: "",
        is_default_shipping: false,
        is_default_pickup: false,
    });

    const previewLat = Number(formData.latitude);
    const previewLon = Number(formData.longitude);
    const hasCoordinates = Number.isFinite(previewLat) && Number.isFinite(previewLon);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.label || !formData.recipient_name || !formData.phone || !formData.full_address) {
            setError("Semua field bertanda * wajib diisi");
            return;
        }

        startTransition(async () => {
            try {
                await createAddress({
                    label: formData.label,
                    recipient_name: formData.recipient_name,
                    phone: formData.phone,
                    full_address: formData.full_address,
                    postal_code: formData.postal_code || undefined,
                    latitude: formData.latitude || undefined,
                    longitude: formData.longitude || undefined,
                    is_default_shipping: formData.is_default_shipping,
                    is_default_pickup: formData.is_default_pickup,
                });
                setIsOpen(false);
                setFormData({
                    label: "",
                    recipient_name: "",
                    phone: "",
                    full_address: "",
                    postal_code: "",
                    latitude: "",
                    longitude: "",
                    is_default_shipping: false,
                    is_default_pickup: false,
                });
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menambah alamat");
            }
        });
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 cursor-pointer overflow-hidden rounded-lg h-10 px-5 bg-brand-primary hover:bg-brand-primary-dark transition-colors text-white text-sm font-bold shadow-lg shadow-brand-primary/20"
            >
                <Plus className="w-5 h-5" />
                <span className="truncate">Tambah Alamat Baru</span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Tambah Alamat Baru
                            </h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Label Alamat *
                                </label>
                                <input
                                    type="text"
                                    value={formData.label}
                                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                    placeholder="Contoh: Rumah, Kantor, Gudang"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nama Penerima *
                                </label>
                                <input
                                    type="text"
                                    value={formData.recipient_name}
                                    onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                                    placeholder="Nama lengkap penerima"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Nomor Telepon *
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="08xx-xxxx-xxxx"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Alamat Lengkap *
                                </label>
                                <textarea
                                    value={formData.full_address}
                                    onChange={(e) => setFormData({ ...formData, full_address: e.target.value })}
                                    placeholder="Jalan, RT/RW, Kelurahan, Kecamatan, Kota, Provinsi"
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Titik Lokasi
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsMapOpen(true)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 hover:border-brand-primary transition-colors"
                                >
                                    <div className="h-28 relative">
                                        <AddressMapPreview
                                            addressText={formData.full_address}
                                            latitude={formData.latitude || null}
                                            longitude={formData.longitude || null}
                                            className="absolute inset-0"
                                        />
                                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                            <MapPin className="w-6 h-6 text-white drop-shadow" />
                                        </div>
                                    </div>
                                </button>
                                <p className="text-xs text-slate-500 mt-2">
                                    {hasCoordinates
                                        ? `Koordinat: ${previewLat.toFixed(6)}, ${previewLon.toFixed(6)}`
                                        : "Belum ada titik. Sistem akan mencoba dari alamat atau lokasi perangkat."}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Kode Pos
                                </label>
                                <input
                                    type="text"
                                    value={formData.postal_code}
                                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                    placeholder="12345"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                                />
                            </div>

                            <div className="flex flex-col gap-3 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_default_shipping}
                                        onChange={(e) => setFormData({ ...formData, is_default_shipping: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Jadikan alamat utama pengiriman
                                    </span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_default_pickup}
                                        onChange={(e) => setFormData({ ...formData, is_default_pickup: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                    />
                                    <span className="text-sm text-slate-700 dark:text-slate-300">
                                        Jadikan alamat utama penjemputan
                                    </span>
                                </label>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="flex-1 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="flex-1 px-4 py-3 rounded-lg bg-brand-primary text-white font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-brand-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Menyimpan...
                                        </>
                                    ) : (
                                        "Simpan Alamat"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>

                    <MapLocationDialog
                        open={isMapOpen}
                        onClose={() => setIsMapOpen(false)}
                        addressText={formData.full_address}
                        initialLatitude={formData.latitude || null}
                        initialLongitude={formData.longitude || null}
                        onSelect={(coords) => {
                            setFormData((prev) => ({
                                ...prev,
                                latitude: coords.latitude,
                                longitude: coords.longitude,
                            }));
                        }}
                    />
                </div>
            )}
        </>
    );
}
