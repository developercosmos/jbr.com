"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createOrderFromOffer } from "@/actions/orders";

interface Address {
    id: string;
    label: string | null;
    full_address: string | null;
}

interface Props {
    offerId: string;
    token: string;
    amount: number;
    listing: { id: string; title: string; slug: string; listPrice: number };
    expiresAt: string | null;
    addresses: Address[];
}

export default function OfferCheckoutClient({ token, amount, listing, expiresAt, addresses }: Props) {
    const router = useRouter();
    const [addressId, setAddressId] = useState<string>(addresses[0]?.id ?? "");
    const [courier, setCourier] = useState<"jne" | "pos" | "tiki">("jne");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const savings = listing.listPrice - amount;

    function handlePlaceOrder() {
        setError(null);
        if (!addressId) {
            setError("Pilih alamat pengiriman terlebih dahulu.");
            return;
        }
        startTransition(async () => {
            try {
                const result = await createOrderFromOffer({
                    token,
                    shipping_address_id: addressId,
                    shipping_courier: courier,
                });
                router.push(`/payment/${result.orderId}`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membuat pesanan.");
            }
        });
    }

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-2">
                <Link
                    href={`/product/${listing.slug}`}
                    className="font-semibold text-slate-900 dark:text-white hover:underline"
                >
                    {listing.title}
                </Link>
                <div className="text-sm text-slate-500">Harga listing: Rp {listing.listPrice.toLocaleString("id-ID")}</div>
                <div className="text-sm">
                    Harga terkunci: <strong className="text-brand-primary">Rp {amount.toLocaleString("id-ID")}</strong>
                </div>
                {savings > 0 && (
                    <div className="text-xs text-emerald-700 dark:text-emerald-300">
                        Hemat Rp {savings.toLocaleString("id-ID")} dari harga listing.
                    </div>
                )}
                {expiresAt && (
                    <div className="text-xs text-slate-500">
                        Token kadaluarsa: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(expiresAt))}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3 text-sm">
                <h3 className="font-bold text-slate-900 dark:text-white">Alamat & Kurir</h3>
                {addresses.length === 0 ? (
                    <div className="text-rose-600 text-xs">
                        Tambahkan alamat pengiriman terlebih dahulu di{" "}
                        <Link href="/profile/address" className="underline">/profile/address</Link>.
                    </div>
                ) : (
                    <>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Alamat Pengiriman</label>
                            <select
                                value={addressId}
                                onChange={(e) => setAddressId(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                            >
                                {addresses.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.label ? `${a.label} — ` : ""}{a.full_address ?? a.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Kurir</label>
                            <select
                                value={courier}
                                onChange={(e) => setCourier(e.target.value as "jne" | "pos" | "tiki")}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                            >
                                <option value="jne">JNE</option>
                                <option value="pos">POS Indonesia</option>
                                <option value="tiki">TIKI</option>
                            </select>
                        </div>
                    </>
                )}
                {error && <p className="text-xs text-rose-600">{error}</p>}
                <button
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={isPending || addresses.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-primary hover:bg-blue-600 text-white rounded-xl font-bold disabled:opacity-60"
                >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Buat Pesanan & Lanjut Bayar
                </button>
            </div>

            <Link href="/profile/offers" className="text-sm text-brand-primary hover:underline">
                ← Lihat penawaran lain
            </Link>
        </div>
    );
}
