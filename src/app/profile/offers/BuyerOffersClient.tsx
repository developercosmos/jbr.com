"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, CheckCircle2, XCircle, Clock, ShoppingBag, ArrowRight } from "lucide-react";
import { acceptOffer, withdrawOffer } from "@/actions/offers";

type OfferRow = {
    id: string;
    amount: string;
    status: string;
    round: number;
    actor_role: string;
    is_auto_counter: boolean;
    expires_at: Date | string;
    decided_at: Date | string | null;
    created_at: Date | string;
    notes: string | null;
    checkout_token: string | null;
    listing: {
        id: string;
        title: string;
        slug: string;
        price: string;
    } | null;
    seller: {
        id: string;
        name: string;
        store_name: string | null;
    } | null;
};

interface Props {
    threads: OfferRow[][];
}

const STATUS_META: Record<string, { label: string; classes: string; icon: typeof Clock }> = {
    PENDING: { label: "Menunggu Respon", classes: "bg-amber-100 text-amber-700", icon: Clock },
    COUNTERED: { label: "Counter dari Penjual", classes: "bg-purple-100 text-purple-700", icon: ArrowRight },
    ACCEPTED: { label: "Diterima — siap checkout", classes: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
    REJECTED: { label: "Ditolak", classes: "bg-rose-100 text-rose-700", icon: XCircle },
    EXPIRED: { label: "Kedaluwarsa", classes: "bg-slate-200 text-slate-700", icon: Clock },
    WITHDRAWN: { label: "Dibatalkan", classes: "bg-slate-200 text-slate-600", icon: XCircle },
};

function formatRupiah(value: string | number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(typeof value === "string" ? Number(value) : value);
}

function formatDateTime(value: string | Date | null): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export function BuyerOffersClient({ threads }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    function handleWithdraw(offerId: string) {
        if (!confirm("Yakin batalkan tawaran ini? Tindakan tidak dapat dibatalkan.")) return;
        setPendingId(offerId);
        setMessage(null);
        startTransition(async () => {
            try {
                await withdrawOffer(offerId);
                setMessage({ type: "success", text: "Tawaran berhasil dibatalkan." });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal membatalkan tawaran." });
            } finally {
                setPendingId(null);
            }
        });
    }

    function handleAccept(offerId: string) {
        if (!confirm("Terima counter ini dan lanjut ke checkout?")) return;
        setPendingId(offerId);
        setMessage(null);
        startTransition(async () => {
            try {
                const result = await acceptOffer(offerId);
                if (result.success && result.checkoutToken) {
                    router.push(`/checkout/offer/${result.checkoutToken}`);
                } else {
                    setMessage({ type: "error", text: "Gagal menerima counter. Coba lagi." });
                }
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menerima counter." });
            } finally {
                setPendingId(null);
            }
        });
    }

    return (
        <div className="space-y-4">
            {message && (
                <div className={`rounded-lg border px-4 py-3 text-sm ${message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}>
                    {message.text}
                </div>
            )}

            {threads.map((rounds) => {
                const latest = rounds[0];
                const product = latest.listing;
                const seller = latest.seller;
                const statusMeta = STATUS_META[latest.status] ?? STATUS_META.PENDING;
                const StatusIcon = statusMeta.icon;

                // Buyer can withdraw only when latest is PENDING from buyer side.
                const canWithdraw =
                    latest.status === "PENDING" && latest.actor_role === "buyer";
                // Buyer can accept when latest is PENDING from seller side (counter).
                const canAcceptCounter =
                    latest.status === "PENDING" && latest.actor_role === "seller";
                // Buyer can checkout when ACCEPTED with token.
                const canCheckout =
                    latest.status === "ACCEPTED" && !!latest.checkout_token;

                return (
                    <div key={latest.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                        <div className="p-4 flex flex-col sm:flex-row gap-4 border-b border-slate-100">
                            <Link
                                href={product ? `/product/${product.slug}` : "#"}
                                className="flex-shrink-0 w-20 h-20 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center"
                            >
                                <ShoppingBag className="w-8 h-8 text-slate-300" />
                            </Link>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase px-2 py-0.5 rounded-full ${statusMeta.classes}`}>
                                        <StatusIcon className="w-3 h-3" />
                                        {statusMeta.label}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        {rounds.length > 1 ? `${rounds.length} ronde` : "Ronde 1"}
                                    </span>
                                </div>
                                {product ? (
                                    <Link
                                        href={`/product/${product.slug}`}
                                        className="font-semibold text-slate-900 hover:text-brand-primary line-clamp-1"
                                    >
                                        {product.title}
                                    </Link>
                                ) : (
                                    <span className="font-semibold text-slate-500 italic">Produk tidak tersedia</span>
                                )}
                                <div className="text-xs text-slate-500 mt-1">
                                    Penjual: {seller?.store_name || seller?.name || "-"}
                                    {product?.price && (
                                        <> · Harga listing: <span className="font-medium">{formatRupiah(product.price)}</span></>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end justify-between gap-2">
                                <div className="text-right">
                                    <div className="text-xs text-slate-500">Tawaran terakhir</div>
                                    <div className="text-lg font-bold text-amber-700">{formatRupiah(latest.amount)}</div>
                                </div>
                                <div className="flex gap-2">
                                    {canCheckout && latest.checkout_token && (
                                        <Link
                                            href={`/checkout/offer/${latest.checkout_token}`}
                                            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                                        >
                                            Lanjut Checkout
                                        </Link>
                                    )}
                                    {canAcceptCounter && (
                                        <button
                                            type="button"
                                            disabled={isPending && pendingId === latest.id}
                                            onClick={() => handleAccept(latest.id)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60"
                                        >
                                            {isPending && pendingId === latest.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                            Terima Counter
                                        </button>
                                    )}
                                    {canWithdraw && (
                                        <button
                                            type="button"
                                            disabled={isPending && pendingId === latest.id}
                                            onClick={() => handleWithdraw(latest.id)}
                                            className="px-3 py-1.5 text-xs rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                        >
                                            {isPending && pendingId === latest.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Batalkan"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {rounds.length > 1 && (
                            <details className="bg-slate-50">
                                <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                                    Lihat semua ronde negosiasi ({rounds.length})
                                </summary>
                                <ol className="px-4 pb-4 space-y-2">
                                    {rounds.map((round) => (
                                        <li key={round.id} className="flex items-center justify-between text-xs gap-3 border-l-2 border-slate-200 pl-3 py-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-700">Ronde {round.round}</span>
                                                <span className="text-slate-500">
                                                    {round.is_auto_counter
                                                        ? "🤖 Auto-counter sistem"
                                                        : round.actor_role === "buyer"
                                                            ? "Anda menawar"
                                                            : "Penjual meng-counter"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-semibold text-slate-900">{formatRupiah(round.amount)}</span>
                                                <span className="text-slate-400">{formatDateTime(round.created_at)}</span>
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </details>
                        )}

                        <div className="px-4 py-2 bg-slate-50 text-[11px] text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>Dikirim: {formatDateTime(latest.created_at)}</span>
                            <span>Berakhir: {formatDateTime(latest.expires_at)}</span>
                            {latest.decided_at && <span>Diputuskan: {formatDateTime(latest.decided_at)}</span>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Suppress unused import — Image reserved for future product thumbnail wiring.
void Image;
