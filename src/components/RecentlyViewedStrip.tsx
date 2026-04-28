"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { syncRecentlyViewedFromClient } from "@/actions/recently-viewed";

const STORAGE_KEY = "jbr_recently_viewed_v1";
const MAX_LOCAL = 12;

interface SeedItem {
    id: string;
    slug: string;
    title: string;
    price: string;
    images: string[] | null;
}

interface RecentlyViewedStripProps {
    /**
     * Server-side hydration for logged-in users — passed from layout/page that
     * fetched via getRecentlyViewedForUser. For anonymous users this is empty
     * and the strip falls back to client-side localStorage.
     */
    seed?: SeedItem[];
}

interface LocalEntry {
    id: string;
    slug: string;
    title: string;
    price: string;
    image: string | null;
    viewed_at: number;
}

function readLocal(): LocalEntry[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(0, MAX_LOCAL);
    } catch {
        return [];
    }
}

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

export function RecentlyViewedStrip({ seed = [] }: RecentlyViewedStripProps) {
    const [items, setItems] = useState<LocalEntry[]>(() =>
        seed.map((s) => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            price: s.price,
            image: s.images?.[0] ?? null,
            viewed_at: Date.now(),
        }))
    );

    useEffect(() => {
        // On mount, merge localStorage with server-seeded list. Server entries
        // win on conflict (more authoritative timestamp); local fills gaps when
        // the server hasn't synced yet (e.g. anonymous browsing).
        const local = readLocal();
        if (local.length === 0 && seed.length > 0) {
            // Hydrate localStorage from server so anonymous browsing later
            // still shows the strip.
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
            } catch {
                // ignore quota errors
            }
            return;
        }
        if (seed.length === 0 && local.length > 0) {
            setItems(local);
            // Best-effort sync to server when authenticated.
            const ids = local.map((l) => l.id);
            syncRecentlyViewedFromClient(ids).catch(() => {
                // ignore — user might be anonymous
            });
            return;
        }
        const merged = new Map<string, LocalEntry>();
        for (const entry of [...local, ...items]) {
            const existing = merged.get(entry.id);
            if (!existing || existing.viewed_at < entry.viewed_at) {
                merged.set(entry.id, entry);
            }
        }
        const sorted = Array.from(merged.values()).sort((a, b) => b.viewed_at - a.viewed_at).slice(0, MAX_LOCAL);
        setItems(sorted);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
        } catch {
            // ignore quota errors
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (items.length === 0) return null;

    return (
        <section className="border-t border-slate-200 bg-slate-50/60 py-6">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 mb-3">
                    Baru saja Anda lihat
                </h2>
                <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                    {items.map((item) => (
                        <Link
                            key={item.id}
                            href={`/product/${item.slug}`}
                            className="flex-shrink-0 w-36 group"
                        >
                            <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 group-hover:border-brand-primary transition-colors">
                                {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.title}
                                        fill
                                        sizes="144px"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                                        No image
                                    </div>
                                )}
                            </div>
                            <p className="mt-1 text-xs font-medium text-slate-700 line-clamp-2 group-hover:text-brand-primary transition-colors">
                                {item.title}
                            </p>
                            <p className="text-xs font-bold text-brand-primary">
                                {formatPrice(item.price)}
                            </p>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function PdpRecentlyViewedRecorder({ productId, slug, title, price, image }: {
    productId: string;
    slug: string;
    title: string;
    price: string;
    image: string | null;
}) {
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            const local = readLocal().filter((entry) => entry.id !== productId);
            const next: LocalEntry[] = [
                { id: productId, slug, title, price, image, viewed_at: Date.now() },
                ...local,
            ].slice(0, MAX_LOCAL);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
            // ignore quota errors
        }

        // Fire-and-forget server sync for authenticated users.
        import("@/actions/recently-viewed").then(({ recordRecentlyViewed }) => {
            recordRecentlyViewed(productId).catch(() => {
                // anonymous → no-op
            });
        });
    }, [productId, slug, title, price, image]);

    return null;
}
