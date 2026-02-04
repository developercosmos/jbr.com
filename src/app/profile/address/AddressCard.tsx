"use client";

import { CheckCircle, Truck, Package, Phone, MapPin, Trash2 } from "lucide-react";
import { deleteAddress, setDefaultAddress } from "@/actions/address";
import { useState, useTransition } from "react";

interface Address {
    id: string;
    label: string;
    recipient_name: string;
    phone: string;
    full_address: string;
    postal_code: string | null;
    is_default_shipping: boolean | null;
    is_default_pickup: boolean | null;
}

export function AddressCard({ address }: { address: Address }) {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState("");

    const handleSetDefault = (type: "shipping" | "pickup") => {
        setError("");
        startTransition(async () => {
            try {
                await setDefaultAddress(address.id, type);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengubah alamat");
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
                setError(err instanceof Error ? err.message : "Gagal menghapus alamat");
            }
        });
    };

    const isPrimary = address.is_default_shipping || address.is_default_pickup;

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
                {/* Map placeholder */}
                <div className="w-full sm:w-32 h-20 rounded-lg overflow-hidden relative border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-slate-400" />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center gap-3 mt-auto">
                <button
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
        </div>
    );
}
