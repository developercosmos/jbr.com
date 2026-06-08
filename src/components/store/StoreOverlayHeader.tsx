import Image from "next/image";
import Link from "next/link";
import { Verified, Package, Calendar, Star, ChevronRight } from "lucide-react";
import { StoreActionButtons } from "@/components/store/StoreActionButtons";

interface StoreOverlayHeaderProps {
    seller: {
        id: string;
        store_name: string | null;
        image: string | null;
        store_banner_url: string | null;
        tier: "T0" | "T1" | "T2" | string | null;
        created_at: Date;
    };
    reputation: { avgRating: number; ratingCount: number };
    followerCount: number;
    productCount: number;
    isFollowing: boolean;
    isOwnStore: boolean;
}

/**
 * Shopee-style store header: the banner is a full-bleed background and the store
 * identity (avatar, name, rating, followers, actions) is overlaid on top with a
 * gradient scrim for readability. Opt-in per seller (store_header_overlay).
 * Uses object-cover here (full-bleed) — the seller chose this layout.
 */
export function StoreOverlayHeader({
    seller,
    reputation,
    followerCount,
    productCount,
    isFollowing,
    isOwnStore,
}: StoreOverlayHeaderProps) {
    const verified = seller.tier === "T1" || seller.tier === "T2";
    const storeName = seller.store_name ?? "Toko";
    const joined = new Date(seller.created_at).toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    return (
        <div className="relative w-full aspect-[12/5] overflow-hidden bg-slate-900">
            {/* Banner background — aspect locked to ~2.4:1 so a well-sized banner
                fills with only minimal crop (instead of a tall box that zooms it). */}
            {seller.store_banner_url && (
                <Image
                    src={seller.store_banner_url}
                    alt={`Banner ${storeName}`}
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                    unoptimized
                />
            )}
            {/* Scrim for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />

            {/* Breadcrumb (top) */}
            <div className="absolute inset-x-0 top-0">
                <nav className="max-w-7xl mx-auto px-4 md:px-8 pt-3 flex items-center gap-2 text-xs text-white/80">
                    <Link href="/" className="hover:text-white">Home</Link>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span className="text-white font-medium truncate">{storeName}</span>
                </nav>
            </div>

            {/* Identity (overlaid at the bottom) */}
            <div className="absolute inset-x-0 bottom-0">
                <div className="max-w-7xl mx-auto px-4 md:px-8 pb-4 md:pb-6 flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="relative w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-2xl overflow-hidden ring-4 ring-white/85 bg-white flex items-center justify-center text-2xl md:text-3xl font-bold text-brand-primary shadow-xl">
                        {seller.image ? (
                            <Image src={seller.image} alt={storeName} fill sizes="80px" className="object-cover" unoptimized />
                        ) : (
                            storeName.charAt(0).toUpperCase()
                        )}
                    </div>

                    <div className="flex-1 min-w-0 text-white">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-xl md:text-3xl font-bold drop-shadow-sm truncate">{storeName}</h1>
                            {verified && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-xs font-semibold">
                                    <Verified className="w-3.5 h-3.5" /> Verified
                                </span>
                            )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs md:text-sm text-white/90 drop-shadow-sm">
                            {reputation.ratingCount > 0 ? (
                                <span className="inline-flex items-center gap-1">
                                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                    <span className="font-bold">{reputation.avgRating.toFixed(1)}</span>
                                    <span className="text-white/70">({reputation.ratingCount} ulasan)</span>
                                </span>
                            ) : (
                                <span className="text-white/70">Belum ada review</span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                                <Package className="w-4 h-4" /> {productCount} produk
                            </span>
                            {followerCount > 0 && <span>{followerCount} pengikut</span>}
                            <span className="hidden sm:inline-flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" /> Bergabung {joined}
                            </span>
                        </div>
                    </div>

                    <div className="shrink-0">
                        <StoreActionButtons sellerId={seller.id} initialIsFollowing={isFollowing} isOwnStore={isOwnStore} />
                    </div>
                </div>
            </div>
        </div>
    );
}
