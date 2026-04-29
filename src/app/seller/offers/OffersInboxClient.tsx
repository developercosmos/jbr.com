"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check, X, RotateCw } from "lucide-react";
import { acceptOffer, counterOffer, rejectOffer } from "@/actions/offers";
import { submitBuyerInteractionRating } from "@/actions/reputation";

type Status = "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED" | "WITHDRAWN";

interface SerializedOffer {
    id: string;
    amount: number;
    status: Status;
    round: number;
    actorRole: string;
    expiresAt: string;
    createdAt: string;
    notes: string | null;
    listing: { id: string; title: string; slug: string; price: string } | null;
    buyerId: string | null;
    buyerName: string | null;
}

interface Props {
    offers: SerializedOffer[];
}

const STATUS_BADGE: Record<Status, string> = {
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    COUNTERED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    EXPIRED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    WITHDRAWN: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

function formatDate(iso: string): string {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function OffersInboxClient({ offers }: Props) {
    const router = useRouter();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [counterDraft, setCounterDraft] = useState<Record<string, string>>({});
    const [ratingDraft, setRatingDraft] = useState<Record<string, { rating: string; note: string }>>({});
    const [error, setError] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    function withTransition(fn: () => Promise<void>) {
        startTransition(() => fn());
    }

    function handleAccept(offerId: string) {
        setError(null);
        setInfo(null);
        setActiveId(offerId);
        withTransition(async () => {
            try {
                const result = await acceptOffer(offerId);
                setInfo(`Penawaran diterima. Buyer punya checkout token sampai ${formatDate(result.checkoutExpiresAt)}.`);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menerima penawaran.");
            } finally {
                setActiveId(null);
            }
        });
    }

    function handleReject(offerId: string) {
        setError(null);
        setInfo(null);
        setActiveId(offerId);
        withTransition(async () => {
            try {
                await rejectOffer(offerId);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menolak penawaran.");
            } finally {
                setActiveId(null);
            }
        });
    }

    function handleCounter(offerId: string) {
        setError(null);
        const raw = counterDraft[offerId];
        const numeric = Number(raw);
        if (!raw || Number.isNaN(numeric) || numeric <= 0) {
            setError("Nominal counter harus angka positif.");
            return;
        }
        setActiveId(offerId);
        withTransition(async () => {
            try {
                await counterOffer({ parentOfferId: offerId, amount: numeric });
                setCounterDraft((prev) => ({ ...prev, [offerId]: "" }));
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengirim counter.");
            } finally {
                setActiveId(null);
            }
        });
    }

    function handleOfferBuyerRating(offerId: string, buyerId: string | null) {
        setError(null);
        setInfo(null);
        if (!buyerId) {
            setError("Buyer tidak valid untuk offer ini.");
            return;
        }

        const draft = ratingDraft[offerId] ?? { rating: "", note: "" };
        const numeric = Number(draft.rating);
        if (!draft.rating || Number.isNaN(numeric) || numeric < 1 || numeric > 5) {
            setError("Rating buyer untuk konteks offer harus 1-5.");
            return;
        }

        setActiveId(offerId);
        withTransition(async () => {
            try {
                await submitBuyerInteractionRating({
                    contextType: "OFFER",
                    contextId: offerId,
                    buyerId,
                    rating: numeric,
                    tags: [],
                    note: draft.note.trim() || undefined,
                });
                setInfo("Penilaian calon buyer dari offer berhasil disimpan.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan rating calon buyer.");
            } finally {
                setActiveId(null);
            }
        });
    }

    if (offers.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-500 dark:text-slate-400">
                Belum ada penawaran masuk.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {error && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-900/20 p-3 text-sm text-rose-700 dark:text-rose-200">
                    {error}
                </div>
            )}
            {info && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    {info}
                </div>
            )}

            {offers.map((offer) => {
                const listingPrice = offer.listing ? Number(offer.listing.price) : 0;
                const canDecide = offer.status === "PENDING" && offer.actorRole === "buyer";
                const isLatestSellerMove = offer.status === "PENDING" && offer.actorRole === "seller";
                return (
                    <div
                        key={offer.id}
                        className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 p-5"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1 text-sm">
                                <div className="flex flex-wrap items-center gap-2">
                                    {offer.listing && (
                                        <Link
                                            href={`/product/${offer.listing.slug}`}
                                            className="font-semibold text-slate-900 dark:text-white hover:underline"
                                            target="_blank"
                                        >
                                            {offer.listing.title}
                                        </Link>
                                    )}
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[offer.status]}`}>
                                        {offer.status}
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                        Ronde {offer.round}
                                    </span>
                                </div>
                                <div className="text-xs text-slate-500">
                                    Buyer: {offer.buyerName ?? "—"} · Tawar: <strong>Rp {offer.amount.toLocaleString("id-ID")}</strong>
                                    {listingPrice > 0 && (
                                        <span> ({Math.round((offer.amount / listingPrice) * 100)}% dari harga listing)</span>
                                    )}
                                </div>
                                <div className="text-xs text-slate-500">
                                    Dibuat {formatDate(offer.createdAt)} · Expire {formatDate(offer.expiresAt)}
                                </div>
                                {offer.notes && (
                                    <div className="text-xs text-slate-500">Catatan: {offer.notes}</div>
                                )}
                            </div>
                        </div>

                        {canDecide && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
                                <input
                                    type="number"
                                    placeholder="Counter (Rp)"
                                    value={counterDraft[offer.id] ?? ""}
                                    onChange={(e) =>
                                        setCounterDraft((prev) => ({ ...prev, [offer.id]: e.target.value }))
                                    }
                                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-sm w-40"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleCounter(offer.id)}
                                    disabled={isPending && activeId === offer.id}
                                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-brand-primary"
                                >
                                    <RotateCw className="w-3 h-3" /> Counter
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAccept(offer.id)}
                                    disabled={isPending && activeId === offer.id}
                                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                                >
                                    {isPending && activeId === offer.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Check className="w-3 h-3" />
                                    )}
                                    Setujui
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleReject(offer.id)}
                                    disabled={isPending && activeId === offer.id}
                                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-900/20"
                                >
                                    <X className="w-3 h-3" /> Tolak
                                </button>
                            </div>
                        )}
                        {isLatestSellerMove && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                                Menunggu respon buyer.
                            </div>
                        )}

                        {offer.status !== "PENDING" && offer.buyerId && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Penilaian Calon Buyer (konteks offer)
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <select
                                        value={ratingDraft[offer.id]?.rating ?? ""}
                                        onChange={(e) =>
                                            setRatingDraft((prev) => ({
                                                ...prev,
                                                [offer.id]: {
                                                    rating: e.target.value,
                                                    note: prev[offer.id]?.note ?? "",
                                                },
                                            }))
                                        }
                                        className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-xs"
                                    >
                                        <option value="">Rating 1-5</option>
                                        <option value="1">1</option>
                                        <option value="2">2</option>
                                        <option value="3">3</option>
                                        <option value="4">4</option>
                                        <option value="5">5</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Catatan singkat (opsional)"
                                        value={ratingDraft[offer.id]?.note ?? ""}
                                        onChange={(e) =>
                                            setRatingDraft((prev) => ({
                                                ...prev,
                                                [offer.id]: {
                                                    rating: prev[offer.id]?.rating ?? "",
                                                    note: e.target.value,
                                                },
                                            }))
                                        }
                                        className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-xs min-w-[220px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleOfferBuyerRating(offer.id, offer.buyerId)}
                                        disabled={isPending && activeId === offer.id}
                                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                                    >
                                        {isPending && activeId === offer.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                        Simpan Rating
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
