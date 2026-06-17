"use client";

import { Star } from "lucide-react";
import { BUYER_RATING_LEVELS } from "@/lib/buyer-rating";

/**
 * Collapsible guide for the 1–5 buyer rating scale (persona + description).
 * Rendered next to every seller-rates-buyer control so the meaning is one tap away.
 */
export function BuyerRatingLegend({ className = "" }: { className?: string }) {
    return (
        <details className={className}>
            <summary className="cursor-pointer text-[11px] font-semibold text-brand-primary hover:underline list-none">
                ⓘ Skala Rating 1 s.d 5 untuk Pembeli
            </summary>
            <ul className="mt-2 space-y-2.5">
                {[...BUYER_RATING_LEVELS].reverse().map((lvl) => (
                    <li key={lvl.value} className="text-[11px] leading-snug">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex" aria-hidden>
                                {Array.from({ length: lvl.value }).map((_, i) => (
                                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                ))}
                            </span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                Bintang {lvl.value} — {lvl.title}{" "}
                                <span className="font-normal text-slate-400">({lvl.english})</span>
                            </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 mt-0.5">{lvl.description}</p>
                    </li>
                ))}
            </ul>
        </details>
    );
}
