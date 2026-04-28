"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { recordProductEvent, recordProductEvents } from "@/actions/product-events";

/**
 * ANLY-01 / ANLY-03: client-side IMPRESSION + CLICK tracker for product cards.
 *
 * Wraps a Next/Link and emits:
 *   - IMPRESSION (batched, debounced) when the card scrolls into view ≥50%.
 *   - CLICK (immediate, single) on user activation, with optional search_term
 *     so we can build search→click attribution funnels per query.
 *
 * Impressions are accumulated in a module-level queue and flushed every 1.5s
 * or on `pagehide` to avoid one server call per row.
 */

type ImpressionPayload = {
    productId: string;
    source: string;
    searchTerm?: string;
};

let pendingImpressions: ImpressionPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const seenInSession = new Set<string>();

function flushImpressions() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (pendingImpressions.length === 0) return;
    const batch = pendingImpressions.splice(0, pendingImpressions.length);
    void recordProductEvents({
        events: batch.map((p) => ({
            productId: p.productId,
            eventType: "IMPRESSION" as const,
            source: p.source,
            searchTerm: p.searchTerm,
        })),
    }).catch(() => {
        // best-effort; drop on failure
    });
}

function queueImpression(p: ImpressionPayload) {
    const key = `${p.productId}|${p.source}|${p.searchTerm ?? ""}`;
    if (seenInSession.has(key)) return;
    seenInSession.add(key);
    pendingImpressions.push(p);
    if (!flushTimer) {
        flushTimer = setTimeout(flushImpressions, 1500);
    }
    if (pendingImpressions.length >= 25) {
        flushImpressions();
    }
}

if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flushImpressions);
    window.addEventListener("beforeunload", flushImpressions);
}

interface TrackedProductLinkProps {
    productId: string;
    href: string;
    source: "search" | "home" | "category" | "pdp" | "direct";
    searchTerm?: string;
    className?: string;
    children: React.ReactNode;
}

export function TrackedProductLink({
    productId,
    href,
    source,
    searchTerm,
    className,
    children,
}: TrackedProductLinkProps) {
    const ref = useRef<HTMLAnchorElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof IntersectionObserver === "undefined") {
            queueImpression({ productId, source, searchTerm });
            return;
        }
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                        queueImpression({ productId, source, searchTerm });
                        observer.disconnect();
                        break;
                    }
                }
            },
            { threshold: [0.5] }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [productId, source, searchTerm]);

    function handleClick() {
        // Fire CLICK immediately so we don't lose it across navigation.
        void recordProductEvent({
            productId,
            eventType: "CLICK",
            source,
            searchTerm,
        }).catch(() => undefined);
    }

    return (
        <Link ref={ref} href={href} className={className} onClick={handleClick}>
            {children}
        </Link>
    );
}
