"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Tag, ArrowRight, Loader2, CheckCircle2, Clock, XCircle, AlertTriangle } from "lucide-react";
import { getMyOfferStatusForProduct } from "@/actions/offers";
import { useFlag } from "@/lib/use-flag";

const EXPIRY_WARNING_THRESHOLD_HOURS = 6;

type OfferStatus = NonNullable<Awaited<ReturnType<typeof getMyOfferStatusForProduct>>>;

const STATUS_COPY: Record<string, { label: string; classes: string; icon: typeof Clock }> = {
    PENDING: { label: "Menunggu respon penjual", classes: "bg-amber-100 text-amber-800", icon: Clock },
    COUNTERED: { label: "Penjual meng-counter — perlu respon Anda", classes: "bg-purple-100 text-purple-800", icon: ArrowRight },
    ACCEPTED: { label: "Diterima — siap checkout", classes: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
    REJECTED: { label: "Tawaran sebelumnya ditolak", classes: "bg-rose-100 text-rose-800", icon: XCircle },
    EXPIRED: { label: "Tawaran sebelumnya kedaluwarsa", classes: "bg-slate-200 text-slate-700", icon: Clock },
    WITHDRAWN: { label: "Tawaran sebelumnya dibatalkan", classes: "bg-slate-200 text-slate-600", icon: XCircle },
};

function formatRupiah(value: string): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(Number(value));
}

interface Props {
    productId: string;
    /** When false, render nothing (e.g., guest viewer). */
    isAuthenticated: boolean;
}

/**
 * PDP panel: surfaces buyer's existing offer for this product so they can
 * jump straight to /profile/offers without trying to re-submit and hitting
 * the duplicate-active error.
 *
 * Render strategy: client-side fetch via server action. Keeps the parent
 * server component eligible for ISR caching (revalidate=300) since this
 * component contains no SSR'd per-user bits.
 */
export function MyOfferStatusPanel({ productId, isAuthenticated }: Props) {
    const expiryWarningEnabled = useFlag("dif.offer_expiry_warning");
    const [offer, setOffer] = useState<OfferStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(() => Date.now());

    // Refresh "now" every minute so the countdown stays accurate without a
    // full re-fetch. Only schedules when there's an active offer being shown.
    useEffect(() => {
        if (!offer?.isActive) return;
        const id = setInterval(() => setNow(Date.now()), 60_000);
        return () => clearInterval(id);
    }, [offer?.isActive]);

    const expiryState = useMemo(() => {
        if (!offer?.isActive) return null;
        if (!["PENDING", "COUNTERED"].includes(offer.status)) return null;
        const expiresAtMs = new Date(offer.expiresAt).getTime();
        const remainingMs = expiresAtMs - now;
        const remainingMinutes = Math.max(0, Math.round(remainingMs / 60_000));
        const remainingHours = remainingMs / (60 * 60 * 1000);
        const isUrgent = remainingHours > 0 && remainingHours <= EXPIRY_WARNING_THRESHOLD_HOURS;
        const hasExpired = remainingMs <= 0;
        return { remainingMinutes, remainingHours, isUrgent, hasExpired };
    }, [offer, now]);

    useEffect(() => {
        if (!isAuthenticated) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        getMyOfferStatusForProduct(productId)
            .then((result) => {
                if (!cancelled) setOffer(result);
            })
            .catch(() => {
                if (!cancelled) setOffer(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [productId, isAuthenticated]);

    if (!isAuthenticated) return null;
    if (loading) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Memeriksa status tawaran Anda...
            </div>
        );
    }
    if (!offer) return null;

    const meta = STATUS_COPY[offer.status] ?? STATUS_COPY.PENDING;
    const Icon = meta.icon;

    // Cosmetic: use solid amber tone for active threads, muted slate for closed.
    const containerClasses = offer.isActive
        ? "rounded-xl border border-amber-200 bg-amber-50/60"
        : "rounded-xl border border-slate-200 bg-slate-50";

    const showExpiryWarning =
        expiryWarningEnabled && expiryState?.isUrgent && !expiryState.hasExpired;

    function formatRemaining(minutes: number): string {
        if (minutes < 60) return `${minutes} menit`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins === 0 ? `${hours} jam` : `${hours} jam ${mins} menit`;
    }

    return (
        <div className={`${containerClasses} p-4 space-y-3`}>
            {showExpiryWarning && expiryState && (
                <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-rose-800 leading-relaxed">
                        <span className="font-semibold">
                            Tawaran kedaluwarsa dalam {formatRemaining(expiryState.remainingMinutes)}.
                        </span>{" "}
                        {offer.status === "COUNTERED"
                            ? "Penjual sudah meng-counter — segera respon supaya tidak hangus."
                            : "Hubungi penjual via chat agar tidak terlewat sebelum auto-expire."}
                    </div>
                </div>
            )}

            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                        Tawaran Anda untuk produk ini
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold text-amber-700">
                            {formatRupiah(offer.amount)}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${meta.classes}`}>
                            <Icon className="w-3 h-3" />
                            {meta.label}
                        </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                        Ronde ke-{offer.round}
                        {offer.actorRole === "seller" && offer.status === "PENDING" && " · Counter dari penjual menunggu respon Anda"}
                        {offer.isAutoCounter && " · 🤖 Auto-counter sistem"}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                <Link
                    href="/profile/offers"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary hover:underline"
                >
                    Lihat & Kelola Tawaran Saya
                    <ArrowRight className="w-3 h-3" />
                </Link>
                {offer.status === "ACCEPTED" && offer.checkoutToken && (
                    <Link
                        href={`/checkout/offer/${offer.checkoutToken}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
                    >
                        Lanjut Checkout
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                )}
            </div>
        </div>
    );
}
