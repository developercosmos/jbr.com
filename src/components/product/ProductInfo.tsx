"use client";

import { Heart, Loader2, MessageCircle, Scale, Share2, ShieldCheck, ShoppingCart, Tag, Truck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/actions/cart";
import { startConversation } from "@/actions/chat";
import { createOffer, getOfferWinProbability, prepareOfferLoginDraft } from "@/actions/offers";
import { recordProductEvent } from "@/actions/product-events";
import { addToWishlist } from "@/actions/wishlist";
import { VariantSelector } from "@/components/product/VariantSelector";
import MakeOfferButton from "@/components/product/MakeOfferButton";
import { SellerBadge } from "@/components/seller/SellerBadges";
import { getSellerBadgeTypes } from "@/lib/seller-badges";
import { useFlag } from "@/lib/use-flag";

interface ProductSeller {
    id: string;
    name: string;
    store_name: string | null;
    store_slug: string | null;
    store_description: string | null;
    image: string | null;
    email_verified?: boolean | null;
    store_status?: string | null;
    store_reviewed_at?: string | Date | null;
    created_at?: string | Date | null;
}

interface ProductCategory {
    id: string;
    name: string;
    slug: string;
}

interface ProductInfoProps {
    product: {
        id: string;
        slug: string;
        title: string;
        description: string | null;
        price: string;
        condition: "NEW" | "PRELOVED";
        condition_rating: number | null;
        condition_notes: string | null;
        condition_checklist?: string[] | null;
        stock: number;
        seller: ProductSeller | null;
        category: ProductCategory | null;
        bargain_enabled?: boolean;
        auto_decline_below?: string | null;
        variants: {
            id: string;
            name: string;
            variant_type: string;
            price: string | null;
            stock: number;
            images: string[] | null;
            is_available: boolean;
        }[];
    };
    sellerReputation?: {
        avgRating: number;
        ratingCount: number;
        completionRate: number;
        cancellationRate: number;
        disputeRate?: number;
        responseTimeMinutes: number;
        reliabilityScore?: number;
        reliabilityTier?: "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";
    } | null;
    isAuthenticated: boolean;
    /** Current viewer user id; null = guest. Used to hide self-offer UI. */
    currentUserId?: string | null;
    initialOfferAmount?: string | null;
    sellerJoinedAt?: string | Date | null;
    sellerVerified?: boolean;
    matchScore?: number | null;
}

function formatResponseTime(minutes: number): string {
    if (!minutes || minutes <= 0) return "-";
    if (minutes < 60) return `${minutes} menit`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} jam`;
    return `${Math.round(hours / 24)} hari`;
}

function computeSellerReliabilityScore(input: {
    avgRating: number;
    completionRate: number;
    responseTimeMinutes: number;
}): number {
    const ratingComponent = Math.max(0, Math.min(100, (input.avgRating / 5) * 100)) * 0.45;
    const completionComponent = Math.max(0, Math.min(100, input.completionRate)) * 0.4;
    const responseRaw = input.responseTimeMinutes <= 0
        ? 60
        : Math.max(0, Math.min(100, ((720 - input.responseTimeMinutes) / 720) * 100));
    const responseComponent = responseRaw * 0.15;
    return Math.round(ratingComponent + completionComponent + responseComponent);
}

function getReliabilityBand(score: number): { label: string; className: string } {
    if (score >= 85) return { label: "Sangat Andal", className: "bg-emerald-100 text-emerald-700" };
    if (score >= 70) return { label: "Andal", className: "bg-blue-100 text-blue-700" };
    if (score >= 55) return { label: "Cukup Andal", className: "bg-amber-100 text-amber-700" };
    return { label: "Perlu Validasi", className: "bg-rose-100 text-rose-700" };
}

function formatRelativeJoinedAt(value: string | Date | null | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (diffMs < 0) return null;

    const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
    if (days < 30) return `Bergabung ${days} hari lalu`;

    const months = Math.floor(days / 30);
    if (months < 12) return `Bergabung ${months} bulan lalu`;
    return `Bergabung ${Math.floor(months / 12)} tahun lalu`;
}

export function ProductInfo({
    product,
    sellerReputation,
    isAuthenticated,
    currentUserId,
    initialOfferAmount,
    sellerJoinedAt,
    sellerVerified,
    matchScore,
}: ProductInfoProps) {
    const isOwnProduct = !!currentUserId && product.seller?.id === currentUserId;
    const router = useRouter();
    const inlineOfferEnabled = useFlag("pdp.inline_offer");
    const sellerBadgesEnabled = useFlag("pdp.seller_badges");
    const sellerJoinDateEnabled = useFlag("pdp.seller_join_date");
    const smartOfferGuardrailEnabled = useFlag("dif.smart_offer_guardrail");
    const sellerReliabilityEnabled = useFlag("dif.seller_reliability_score");
    const conditionChecklistEnabled = useFlag("dif.condition_checklist");
    const compareModeEnabled = useFlag("dif.compare_mode");

    const [isPending, startTransition] = useTransition();
    const [isChatPending, startChatTransition] = useTransition();
    const [isWishlistPending, startWishlistTransition] = useTransition();
    const [isOfferPending, startOfferTransition] = useTransition();
    const [added, setAdded] = useState(false);
    const [wishlisted, setWishlisted] = useState(false);
    const [shared, setShared] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [offerAmount, setOfferAmount] = useState<string>(() => initialOfferAmount ?? product.auto_decline_below ?? String(Math.round(parseFloat(product.price) * 0.9)));
    const [offerMessage, setOfferMessage] = useState<{
        type: "success" | "error";
        text: string;
        actionHref?: string;
        actionLabel?: string;
    } | null>(null);
    const [offerWinProbability, setOfferWinProbability] = useState<{ probabilityPct: number | null; sampleSize: number } | null>(null);
    const offerFocusRecorded = useRef(false);
    const badgeViewRecorded = useRef(false);
    // DIF-13: track time-on-page + scroll depth for offer intent score.
    const pdpMountedAtRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : Date.now());
    const maxScrollPctRef = useRef<number>(0);
    const intentScoreEnabled = useFlag("dif.intent_score");

    useEffect(() => {
        if (!intentScoreEnabled || typeof window === "undefined") return;
        const handler = () => {
            const doc = document.documentElement;
            const scrollable = Math.max(1, doc.scrollHeight - doc.clientHeight);
            const pct = Math.min(100, Math.max(0, Math.round((window.scrollY / scrollable) * 100)));
            if (pct > maxScrollPctRef.current) maxScrollPctRef.current = pct;
        };
        handler();
        window.addEventListener("scroll", handler, { passive: true });
        return () => window.removeEventListener("scroll", handler);
    }, [intentScoreEnabled]);

    function getCurrentIntentSignal(): { timeOnPageMs: number; scrollDepthPct: number } | undefined {
        if (!intentScoreEnabled) return undefined;
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        return {
            timeOnPageMs: Math.max(0, Math.round(now - pdpMountedAtRef.current)),
            scrollDepthPct: Math.max(0, Math.min(100, Math.round(maxScrollPctRef.current))),
        };
    }

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const getConditionLabel = () => {
        if (product.condition === "NEW") return "Baru";
        if (product.condition_rating) return `Pre-loved ${product.condition_rating}/10`;
        return "Pre-loved";
    };

    const groupedVariants = product.variants.reduce<Record<string, ProductInfoProps["product"]["variants"]>>(
        (acc, variant) => {
            if (!acc[variant.variant_type]) {
                acc[variant.variant_type] = [];
            }
            acc[variant.variant_type].push(variant);
            return acc;
        },
        {}
    );

    const selectedVariant = product.variants.find((variant) => variant.id === selectedVariantId) ?? null;
    const displayPrice = selectedVariant?.price ?? product.price;
    const displayStock = selectedVariant?.stock ?? product.stock;
    const requiresVariantSelection = product.variants.length > 0 && !selectedVariant;
    const sellerBadges = getSellerBadgeTypes({
        verified: Boolean(sellerVerified),
        responseTimeMinutes: sellerReputation?.responseTimeMinutes ?? 0,
        avgRating: sellerReputation?.avgRating ?? 0,
        ratingCount: sellerReputation?.ratingCount ?? 0,
        completionRate: sellerReputation?.completionRate ?? 0,
        sellerJoinedAt,
    });
    const joinedAtLabel = sellerJoinDateEnabled ? formatRelativeJoinedAt(sellerJoinedAt) : null;
    const reliabilityScore = sellerReputation?.reliabilityScore ?? (sellerReputation
        ? computeSellerReliabilityScore({
            avgRating: sellerReputation.avgRating,
            completionRate: sellerReputation.completionRate,
            responseTimeMinutes: sellerReputation.responseTimeMinutes,
        })
        : null);
    const reliabilityBand = reliabilityScore !== null ? getReliabilityBand(reliabilityScore) : null;
    const offerNumericAmount = Number(offerAmount);
    const offerRatio = Number.isFinite(offerNumericAmount) && Number(product.price) > 0
        ? offerNumericAmount / Number(product.price)
        : 0;

    const guardrailInsight = (() => {
        if (!smartOfferGuardrailEnabled || !offerNumericAmount || offerNumericAmount <= 0) {
            return null;
        }
        if (offerWinProbability?.probabilityPct !== null && offerWinProbability?.probabilityPct !== undefined) {
            if (offerWinProbability.probabilityPct >= 65) {
                return {
                    tone: "text-emerald-700",
                    label: `Peluang diterima tinggi (${offerWinProbability.probabilityPct}% dari histori).`,
                };
            }
            if (offerWinProbability.probabilityPct >= 35) {
                return {
                    tone: "text-amber-700",
                    label: `Peluang diterima sedang (${offerWinProbability.probabilityPct}% dari histori).`,
                };
            }
            return {
                tone: "text-rose-700",
                label: `Peluang diterima rendah (${offerWinProbability.probabilityPct}% dari histori).`,
            };
        }
        if (offerRatio >= 0.9) {
            return { tone: "text-emerald-700", label: "Peluang diterima tinggi" };
        }
        if (offerRatio >= 0.75) {
            return { tone: "text-amber-700", label: "Peluang diterima sedang" };
        }
        return { tone: "text-rose-700", label: "Peluang diterima rendah, pertimbangkan naikkan tawaran" };
    })();

    useEffect(() => {
        if (!smartOfferGuardrailEnabled) return;
        if (!offerNumericAmount || offerNumericAmount <= 0 || offerNumericAmount >= Number(product.price)) {
            setOfferWinProbability(null);
            return;
        }

        const timer = setTimeout(() => {
            void getOfferWinProbability({
                listingId: product.id,
                amount: offerNumericAmount,
            })
                .then((result) => {
                    setOfferWinProbability({
                        probabilityPct: result.probabilityPct,
                        sampleSize: result.sampleSize,
                    });
                })
                .catch(() => setOfferWinProbability(null));
        }, 450);

        return () => clearTimeout(timer);
    }, [offerNumericAmount, product.id, product.price, smartOfferGuardrailEnabled]);

    useEffect(() => {
        if (!sellerBadgesEnabled || badgeViewRecorded.current || sellerBadges.length === 0) return;
        badgeViewRecorded.current = true;
        void recordProductEvent({
            productId: product.id,
            eventType: "SELLER_BADGE_VIEW",
            source: "pdp",
            meta: { badges: sellerBadges },
        }).catch(() => undefined);
    }, [product.id, sellerBadges, sellerBadgesEnabled]);

    const handleAddToCart = () => {
        startTransition(async () => {
            try {
                const result = await addToCart(product.id, 1, selectedVariant?.id);

                if (!result.success && result.error) {
                    if (result.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                    } else if (result.error === "own_product") {
                        alert("Anda tidak dapat menambahkan produk sendiri ke keranjang");
                    } else if (result.error === "product_not_available") {
                        alert("Produk tidak tersedia");
                    } else if (result.error === "variant_required") {
                        alert("Pilih varian produk terlebih dahulu");
                    } else if (result.error === "insufficient_stock") {
                        alert("Stok tidak mencukupi untuk varian yang dipilih");
                    }
                    return;
                }

                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
            } catch (error) {
                console.error("Failed to add to cart:", error);
            }
        });
    };

    const handleChatSeller = () => {
        const seller = product.seller;
        if (!seller) return;

        startChatTransition(async () => {
            try {
                const result = await startConversation(seller.id, product.id);

                if (result.error) {
                    if (result.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}&redirect=/messages`);
                    } else if (result.error === "cannot_message_self") {
                        alert("Anda tidak dapat mengirim pesan ke diri sendiri");
                    }
                    return;
                }

                if (result.conversationId) {
                    void recordProductEvent({
                        productId: product.id,
                        eventType: "CHAT_INITIATED_FROM_PDP",
                        source: "pdp",
                    }).catch(() => undefined);
                    router.push(`/messages?c=${result.conversationId}`);
                }
            } catch (error) {
                console.error("Failed to start conversation:", error);
            }
        });
    };

    const handleAddToWishlist = () => {
        startWishlistTransition(async () => {
            try {
                const result = await addToWishlist(product.id);

                if (!result.success && result.error) {
                    if (result.error === "unauthorized") {
                        router.push(`/auth/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
                    } else if (result.error === "own_product") {
                        alert("Anda tidak dapat menambahkan produk sendiri ke wishlist");
                    }
                    return;
                }

                setWishlisted(true);
                setTimeout(() => setWishlisted(false), 2000);
            } catch (error) {
                console.error("Failed to add to wishlist:", error);
            }
        });
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        const shareTitle = product.title;
        const shareText = `Lihat ${product.title} di Jual Beli Raket!`;

        try {
            if (navigator.share) {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
            } else {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            }
        } catch (error) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                setShared(true);
                setTimeout(() => setShared(false), 2000);
            } catch {
                console.error("Failed to share:", error);
            }
        }
    };

    const handleCompare = () => {
        try {
            const raw = localStorage.getItem("jbr_compare_slugs");
            const parsed = raw ? JSON.parse(raw) : [];
            const next = Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") as string[] : [];
            if (!next.includes(product.slug)) {
                next.push(product.slug);
            }
            const capped = next.slice(-3);
            localStorage.setItem("jbr_compare_slugs", JSON.stringify(capped));
            router.push(`/compare?slugs=${capped.join(",")}`);
        } catch {
            router.push(`/compare?slugs=${product.slug}`);
        }
    };

    const handleOfferFocus = () => {
        if (offerFocusRecorded.current) return;
        offerFocusRecorded.current = true;
        void recordProductEvent({
            productId: product.id,
            eventType: isAuthenticated ? "OFFER_INPUT_FOCUS" : "OFFER_CTA_VIEW",
            source: "pdp",
        }).catch(() => undefined);
    };

    const handleOfferSubmit = () => {
        const numericAmount = Number(offerAmount);
        setOfferMessage(null);

        if (Number.isNaN(numericAmount) || numericAmount <= 0) {
            setOfferMessage({ type: "error", text: "Nominal tawaran harus berupa angka positif." });
            return;
        }
        if (numericAmount >= Number(product.price)) {
            setOfferMessage({ type: "error", text: "Nominal tawaran harus di bawah harga listing." });
            return;
        }
        if (requiresVariantSelection) {
            setOfferMessage({ type: "error", text: "Pilih varian terlebih dahulu sebelum menawar." });
            return;
        }

        void recordProductEvent({
            productId: product.id,
            eventType: isAuthenticated ? "OFFER_SUBMIT" : "OFFER_CTA_CLICK",
            source: "pdp",
            meta: { amount: numericAmount },
        }).catch(() => undefined);

        if (!isAuthenticated) {
            startOfferTransition(async () => {
                try {
                    const result = await prepareOfferLoginDraft({
                        listingId: product.id,
                        amount: numericAmount,
                        returnPath: window.location.pathname,
                    });
                    router.push(result.loginUrl);
                } catch (error) {
                    setOfferMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menyiapkan login untuk tawar." });
                }
            });
            return;
        }

        startOfferTransition(async () => {
            try {
                const result = await createOffer({
                    listingId: product.id,
                    variantId: selectedVariant?.id ?? undefined,
                    amount: numericAmount,
                    intentSignal: getCurrentIntentSignal(),
                });

                if (!result.success) {
                    if (result.error === "rate_limited") {
                        const retryMinutes = Math.max(1, Math.ceil((result.retryAfterSec ?? 0) / 60));
                        setOfferMessage({ type: "error", text: `Terlalu sering menawar. Coba lagi dalam ${retryMinutes} menit.` });
                        void recordProductEvent({
                            productId: product.id,
                            eventType: "OFFER_RATE_LIMITED",
                            source: "pdp",
                            meta: { retryAfterSec: result.retryAfterSec ?? 0 },
                        }).catch(() => undefined);
                        return;
                    }
                    setOfferMessage({
                        type: "error",
                        text: ("message" in result && result.message) ? result.message : "Tawaran tidak dapat dikirim.",
                        actionHref: result.error === "duplicate_active" ? "/profile/offers" : undefined,
                        actionLabel: result.error === "duplicate_active" ? "Lihat tawaran saya" : undefined,
                    });
                    return;
                }

                if (result.autoDeclined) {
                    setOfferMessage({ type: "error", text: "Tawaran otomatis ditolak karena di bawah ambang batas penjual." });
                    void recordProductEvent({
                        productId: product.id,
                        eventType: "OFFER_SUBMIT_REJECTED_RULE",
                        source: "pdp",
                    }).catch(() => undefined);
                    return;
                }

                setOfferMessage({ type: "success", text: "Tawaran berhasil dikirim ke penjual." });
                void recordProductEvent({
                    productId: product.id,
                    eventType: "OFFER_SUBMIT_SUCCESS",
                    source: "pdp",
                }).catch(() => undefined);
                router.refresh();
            } catch (error) {
                setOfferMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal mengirim tawaran." });
            }
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{product.category?.name || "Raket"}</span>
                    <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-100">Kondisi: {getConditionLabel()}</span>
                </div>
                <h1 className="text-3xl font-bold text-slate-900 font-heading leading-tight">{product.title}</h1>
                <div className="flex items-center gap-4 mt-3 text-sm">
                    <span className="text-slate-500">Stok: {displayStock}</span>
                </div>
            </div>

            <div className="flex items-baseline gap-3 pb-6 border-b border-slate-100">
                <span className="text-4xl font-bold text-brand-primary font-heading">{formatPrice(displayPrice)}</span>
                {typeof matchScore === "number" && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
                        Match Score {matchScore}/100
                    </span>
                )}
            </div>

            {product.variants.length > 0 && (
                <div className="space-y-2">
                    <VariantSelector variants={product.variants} grouped={groupedVariants} basePrice={product.price} onVariantSelect={(variant) => setSelectedVariantId(variant?.id ?? null)} />
                    {requiresVariantSelection && <p className="text-sm text-amber-600">Pilih varian sebelum menambahkan ke keranjang.</p>}
                </div>
            )}

            {product.seller && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                        {product.seller.image ? (
                            <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white shadow-sm">
                                <Image src={product.seller.image} alt={product.seller.name} fill className="object-cover" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center">
                                <span className="text-xl text-white font-bold">{(product.seller.store_name || product.seller.name).charAt(0).toUpperCase()}</span>
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900">{product.seller.store_name || product.seller.name}</span>
                                {sellerVerified && <ShieldCheck className="w-4 h-4 text-brand-primary" />}
                            </div>
                            {sellerBadgesEnabled && sellerBadges.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {sellerBadges.map((badge) => (
                                        <SellerBadge key={badge} type={badge} size="sm" />
                                    ))}
                                </div>
                            )}
                            {sellerReputation && sellerReputation.ratingCount > 0 ? (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                                    <span className="font-semibold text-slate-700">★ {sellerReputation.avgRating.toFixed(2)}</span>
                                    <span>({sellerReputation.ratingCount} ulasan)</span>
                                    <span>· {sellerReputation.completionRate.toFixed(0)}% selesai</span>
                                    <span>· respon {formatResponseTime(sellerReputation.responseTimeMinutes)}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 mt-1">Verified Seller</p>
                            )}
                            {sellerReliabilityEnabled && reliabilityScore !== null && reliabilityBand && (
                                <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">Reliability {reliabilityScore}/100</span>
                                    <span className={`rounded-full px-2 py-0.5 ${reliabilityBand.className}`}>
                                        {sellerReputation?.reliabilityTier ? `${sellerReputation.reliabilityTier} · ${reliabilityBand.label}` : reliabilityBand.label}
                                    </span>
                                </div>
                            )}
                            {joinedAtLabel && <p className="text-xs text-slate-500 mt-1">{joinedAtLabel}</p>}
                        </div>
                    </div>
                    {product.seller.store_slug && (
                        <Link
                            href={`/store/${product.seller.store_slug}`}
                            onClick={() => {
                                void recordProductEvent({
                                    productId: product.id,
                                    eventType: "SELLER_CARD_CLICK",
                                    source: "pdp",
                                }).catch(() => undefined);
                            }}
                            className="text-sm font-semibold text-brand-primary hover:underline"
                        >
                            View Profile
                        </Link>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <button onClick={handleAddToCart} disabled={isPending || displayStock === 0 || requiresVariantSelection} className="flex-1 bg-brand-primary hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : added ? <>✓ Ditambahkan</> : <><ShoppingCart className="w-5 h-5" />{displayStock === 0 ? "Stok Habis" : "Add to Cart"}</>}
                    </button>
                    <button onClick={handleChatSeller} disabled={isChatPending || !product.seller} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-900 font-bold py-3.5 px-6 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                        {isChatPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><MessageCircle className="w-5 h-5" />Tanya Penjual</>}
                    </button>
                </div>

                {isOwnProduct ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Ini produk Anda sendiri. Pembeli yang akan melihat panel tawar di sini.
                    </div>
                ) : product.bargain_enabled && inlineOfferEnabled ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <Tag className="w-4 h-4 text-amber-600" />
                                Tawar Harga
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{isAuthenticated ? "Masukkan nominal tawaran Anda langsung dari halaman produk." : "Masuk dulu untuk mengirim tawaran. Nominal Anda akan disimpan sementara."}</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">Rp</span>
                                <input type="number" value={offerAmount} onFocus={handleOfferFocus} onChange={(event) => setOfferAmount(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-9 py-3 text-sm" placeholder="Nominal tawaran" />
                            </div>
                            <button type="button" disabled={isOfferPending} onClick={handleOfferSubmit} className="px-4 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60">
                                {isOfferPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isAuthenticated ? "Kirim" : "Sign in"}
                            </button>
                        </div>
                        {offerMessage && (
                            <p className={`text-xs ${offerMessage.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>
                                {offerMessage.text}
                                {offerMessage.actionHref && offerMessage.actionLabel && (
                                    <>
                                        {" "}
                                        <Link href={offerMessage.actionHref} className="underline font-semibold hover:no-underline">
                                            {offerMessage.actionLabel} →
                                        </Link>
                                    </>
                                )}
                            </p>
                        )}
                        {guardrailInsight && (
                            <div className="space-y-1">
                                <p className={`text-[11px] font-medium ${guardrailInsight.tone}`}>{guardrailInsight.label}</p>
                                {offerWinProbability?.probabilityPct !== null && offerWinProbability?.probabilityPct !== undefined && (
                                    <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${offerWinProbability.probabilityPct}%` }} />
                                    </div>
                                )}
                                {offerWinProbability?.sampleSize ? (
                                    <p className="text-[10px] text-slate-500">Sample histori: {offerWinProbability.sampleSize} negosiasi serupa.</p>
                                ) : null}
                            </div>
                        )}
                        {product.auto_decline_below && <p className="text-[11px] text-slate-500">Ambang batas auto-decline: {formatPrice(product.auto_decline_below)}.</p>}
                    </div>
                ) : product.bargain_enabled ? (
                    <MakeOfferButton listingId={product.id} listingPrice={parseFloat(product.price)} autoDeclineBelow={product.auto_decline_below ? parseFloat(product.auto_decline_below) : null} />
                ) : null}

                <div className="flex gap-3">
                    <button onClick={handleAddToWishlist} disabled={isWishlistPending} className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-red-500 py-2.5 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50">
                        {isWishlistPending ? <Loader2 className="w-4 h-4 animate-spin" /> : wishlisted ? <><Heart className="w-4 h-4 fill-red-500 text-red-500" />Ditambahkan!</> : <><Heart className="w-4 h-4" />Add to Wishlist</>}
                    </button>
                    <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-2 text-slate-600 hover:text-brand-primary py-2.5 rounded-lg hover:bg-blue-50 transition-colors text-sm font-medium">
                        {shared ? <><Share2 className="w-4 h-4" />Link Disalin!</> : <><Share2 className="w-4 h-4" />Share</>}
                    </button>
                </div>
                {compareModeEnabled && (
                    <button onClick={handleCompare} className="w-full flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-medium">
                        <Scale className="w-4 h-4" />
                        Bandingkan Produk
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <ShieldCheck className="w-5 h-5 text-brand-primary shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Garansi Keaslian</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">Produk asli atau uang kembali.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50/50 border border-green-100">
                    <Truck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-xs font-bold text-slate-900">Pengiriman Aman</h4>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">Dilacak dengan asuransi pengiriman.</p>
                    </div>
                </div>
            </div>

            {product.description && (
                <div className="pt-6 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3">Deskripsi</h3>
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{product.description}</div>
                </div>
            )}

            {product.condition_notes && (
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3">Catatan Kondisi</h3>
                    <div className="text-sm text-slate-600 leading-relaxed bg-orange-50 p-4 rounded-lg border border-orange-100">{product.condition_notes}</div>
                </div>
            )}

            {conditionChecklistEnabled && product.condition === "PRELOVED" && (product.condition_checklist?.length ?? 0) > 0 && (
                <div className="pt-4 border-t border-slate-100">
                    <h3 className="font-bold text-slate-900 mb-3">Verified Condition Checklist</h3>
                    <div className="flex flex-wrap gap-2">
                        {(product.condition_checklist ?? []).map((item) => (
                            <span key={item} className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                                {item}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
