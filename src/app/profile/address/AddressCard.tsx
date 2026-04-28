"use client";

import { CheckCircle, Truck, Package, Phone, MapPin, Trash2, X, Loader2 } from "lucide-react";
import { deleteAddress, setDefaultAddress, updateAddress } from "@/actions/address";
import { useState, useTransition } from "react";
import { MapLocationDialog } from "./MapLocationDialog";

interface Address {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    full_address: string;
    postal_code: string | null;
    latitude?: string | null;
    longitude?: string | null;
    is_default_shipping: boolean | null;
    is_default_pickup: boolean | null;
}

export function AddressCard({ address }: { address: Address }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isMapPreviewOpen, setIsMapPreviewOpen] = useState(false);
    const [isEditMapOpen, setIsEditMapOpen] = useState(false);
    const [formData, setFormData] = useState({
        label: address.label,
        recipient_name: address.recipient_name,
        phone: address.phone,
        full_address: address.full_address,
        postal_code: address.postal_code || "",
        latitude: address.latitude || "",
        longitude: address.longitude || "",
        is_default_shipping: Boolean(address.is_default_shipping),
        is_default_pickup: Boolean(address.is_default_pickup),
    });

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof Error && err.message.trim()) {
            return err.message;
        }

        if (typeof err === "string" && err.trim()) {
            return err;
        }

        if (err && typeof err === "object") {
            const maybeError = err as { message?: unknown; error?: unknown };
            if (typeof maybeError.message === "string" && maybeError.message.trim()) {
                return maybeError.message;
            }
            if (typeof maybeError.error === "string" && maybeError.error.trim()) {
                return maybeError.error;
            }
        }

        return fallback;
    };

    const resetForm = () => {
        setFormData({
            label: address.label,
            recipient_name: address.recipient_name,
            phone: address.phone,
            full_address: address.full_address,
            postal_code: address.postal_code || "",
            latitude: address.latitude || "",
            longitude: address.longitude || "",
            is_default_shipping: Boolean(address.is_default_shipping),
            is_default_pickup: Boolean(address.is_default_pickup),
        });
    };

    const handleOpenEdit = () => {
        resetForm();
        setError("");
        setIsEditOpen(true);
    };

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.label || !formData.recipient_name || !formData.phone || !formData.full_address) {
            setError("Semua field bertanda * wajib diisi");
            return;
        }

        startTransition(async () => {
            try {
                await updateAddress({
                    id: address.id,
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
                setIsEditOpen(false);
            } catch (err) {
                setError(getErrorMessage(err, "Gagal mengubah alamat"));
            }
        });
    };

    const handleSetDefault = (type: "shipping" | "pickup") => {
        setError("");
        startTransition(async () => {
            try {
                await setDefaultAddress(address.id, type);
            } catch (err) {
                setError(getErrorMessage(err, "Gagal mengubah alamat"));
            }
        });
    };

    const handleDelete = () => {
        if (!confirm("Yakin ingin menghapus alamat ini?")) return;

        setError("");
        startTransition(async () => {
            try {
                await deleteAddress(address.id);
            } catch (err) {
                setError(getErrorMessage(err, "Gagal menghapus alamat"));
            }
        });
    };

    const isPrimary = address.is_default_shipping || address.is_default_pickup;
    const lat = address.latitude ? Number(address.latitude) : NaN;
    const lon = address.longitude ? Number(address.longitude) : NaN;
    const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
    const mapEmbedUrl = hasCoordinates
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.005}%2C${lat - 0.005}%2C${lon + 0.005}%2C${lat + 0.005}&layer=mapnik&marker=${lat}%2C${lon}`
        : null;

    const editLat = Number(formData.latitude);
    const editLon = Number(formData.longitude);
    const hasEditCoordinates = Number.isFinite(editLat) && Number.isFinite(editLon);
    const editMapPreviewUrl = hasEditCoordinates
        ? `https://www.openstreetmap.org/export/embed.html?bbox=${editLon - 0.003}%2C${editLat - 0.003}%2C${editLon + 0.003}%2C${editLat + 0.003}&layer=mapnik&marker=${editLat}%2C${editLon}`
        : null;

    return (
        <div className={`relative flex flex-col p-5 rounded-xl bg-white dark:bg-surface-dark border transition-all ${isPrimary
                ? "border-brand-primary/40 shadow-[0_0_0_1px_rgba(25,127,230,0.1)] hover:border-brand-primary/60"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
            } ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                        {address.label}
                    </span>
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold">
                        {address.recipient_name}
                    </h3>
                    {isPrimary && (
                        <div title="Alamat Utama">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                    )}
                </div>
                <div className="flex flex-wrap gap-2">
                    {address.is_default_shipping && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-brand-primary text-white">
                            <Truck className="w-3.5 h-3.5" />
                            Utama Pengiriman
                        </span>
                    )}
                    {address.is_default_pickup && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-brand-primary text-white">
                            <Package className="w-3.5 h-3.5" />
                            Utama Penjemputan
                        </span>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-col sm:flex-row gap-6 mb-6">
                <div className="flex-1 text-sm text-slate-500 dark:text-slate-400 space-y-2">
                    <p className="text-slate-900 dark:text-white text-base font-medium">
                        {address.full_address}
                    </p>
                    {address.postal_code && (
                        <p>Kode Pos: {address.postal_code}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1 text-slate-900 dark:text-white">
                        <Phone className="w-4 h-4 text-slate-400" />
                        <span>{address.phone}</span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => setIsMapPreviewOpen(true)}
                    className="w-full sm:w-32 h-20 rounded-lg overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 group"
                    title="Lihat lokasi"
                >
                    {mapEmbedUrl ? (
                        <iframe
                            title={`Peta ${address.label}`}
                            src={mapEmbedUrl}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full border-0"
                            referrerPolicy="no-referrer-when-downgrade"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-700" />
                    )}
                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-white drop-shadow" />
                    </div>
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-auto">
                <button
                    onClick={handleOpenEdit}
                    className="flex items-center justify-center h-9 px-4 rounded-lg bg-transparent border border-slate-300 dark:border-slate-700 hover:border-brand-primary hover:text-brand-primary text-slate-900 dark:text-white text-sm font-semibold transition-colors"
                    disabled={isPending}
                >
                    Ubah Alamat
                </button>
                {!address.is_default_shipping && (
                    <button
                        onClick={() => handleSetDefault("shipping")}
                        className="flex items-center justify-center h-9 px-4 rounded-lg bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-medium transition-colors"
                        disabled={isPending}
                    >
                        Atur sebagai Utama Pengiriman
                    </button>
                )}
                {!address.is_default_shipping && (
                    <button
                        onClick={handleDelete}
                        className="flex items-center justify-center h-9 px-3 rounded-lg bg-transparent hover:bg-red-500/10 hover:text-red-500 text-slate-400 transition-colors ml-auto group"
                        title="Hapus Alamat"
                        disabled={isPending}
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}
            </div>

            {isEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsEditOpen(false)}
                    />
                    <div className="relative bg-white dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                Ubah Alamat
                            </h2>
                            <button
                                onClick={() => setIsEditOpen(false)}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                type="button"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="p-6 space-y-4">
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
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Kode Pos
                                </label>
                                <input
                                    type="text"
                                    value={formData.postal_code}
                                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Titik Lokasi
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsEditMapOpen(true)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 hover:border-brand-primary transition-colors"
                                >
                                    <div className="h-28 relative">
                                        {editMapPreviewUrl ? (
                                            <iframe
                                                title={`Preview lokasi ${formData.label}`}
                                                src={editMapPreviewUrl}
                                                className="absolute inset-0 w-full h-full border-0"
                                                loading="lazy"
                                                referrerPolicy="no-referrer-when-downgrade"
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                                                Klik untuk pilih titik lokasi
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                            <MapPin className="w-6 h-6 text-white drop-shadow" />
                                        </div>
                                    </div>
                                </button>
                                <p className="text-xs text-slate-500 mt-2">
                                    {hasEditCoordinates
                                        ? `Koordinat: ${editLat.toFixed(6)}, ${editLon.toFixed(6)}`
                                        : "Belum ada titik. Sistem akan mencoba dari alamat atau lokasi perangkat."}
                                </p>
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

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
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
                                        "Simpan Perubahan"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <MapLocationDialog
                open={isMapPreviewOpen}
                onClose={() => setIsMapPreviewOpen(false)}
                addressText={address.full_address}
                initialLatitude={address.latitude || null}
                initialLongitude={address.longitude || null}
            />

            <MapLocationDialog
                open={isEditMapOpen}
                onClose={() => setIsEditMapOpen(false)}
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
    );
}
