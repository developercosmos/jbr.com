"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { BUYER_RATING_LEVELS } from "@/lib/buyer-rating";

interface Props {
    /** "" when unset, otherwise "1".."5". */
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** Styling for the trigger button. */
    triggerClassName?: string;
    /** Styling for the outer relative wrapper (e.g. width). */
    className?: string;
}

/**
 * Custom buyer-rating dropdown. Replaces the native <select> so each option can
 * show a STYLED, cross-browser tooltip (persona + description) on hover/focus —
 * native <option title> only renders in Chromium.
 */
export function BuyerRatingSelect({
    value,
    onChange,
    placeholder = "Pilih rating 1–5…",
    triggerClassName = "",
    className = "",
}: Props) {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState<number | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const selected = BUYER_RATING_LEVELS.find((l) => String(l.value) === value) ?? null;

    return (
        <div ref={ref} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={
                    triggerClassName ||
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-xs text-left"
                }
            >
                <span className={selected ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
                    {selected ? `${selected.value} — ${selected.title}` : placeholder}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>

            {open && (
                <ul
                    role="listbox"
                    className="absolute z-50 mt-1 w-full min-w-[180px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-surface-dark shadow-lg py-1"
                >
                    {BUYER_RATING_LEVELS.map((lvl) => {
                        const isSel = String(lvl.value) === value;
                        const isActive = active === lvl.value;
                        return (
                            <li
                                key={lvl.value}
                                className="relative"
                                onMouseEnter={() => setActive(lvl.value)}
                                onMouseLeave={() => setActive((a) => (a === lvl.value ? null : a))}
                            >
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={isSel}
                                    onClick={() => {
                                        onChange(String(lvl.value));
                                        setOpen(false);
                                        setActive(null);
                                    }}
                                    onFocus={() => setActive(lvl.value)}
                                    onBlur={() => setActive((a) => (a === lvl.value ? null : a))}
                                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-colors ${
                                        isSel
                                            ? "bg-amber-50 dark:bg-amber-500/10 font-semibold"
                                            : "hover:bg-amber-50 dark:hover:bg-amber-500/10"
                                    }`}
                                >
                                    <span className="inline-flex flex-shrink-0" aria-hidden>
                                        {Array.from({ length: lvl.value }).map((_, i) => (
                                            <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                                        ))}
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-200 whitespace-nowrap">
                                        {lvl.value} — {lvl.title}
                                    </span>
                                </button>

                                {isActive && (
                                    <div
                                        role="tooltip"
                                        className="pointer-events-none absolute z-[60] w-60 max-w-[calc(100vw-3rem)] rounded-lg bg-slate-900 text-white px-3 py-2 shadow-xl
                                                   left-0 top-full mt-1
                                                   sm:left-full sm:top-0 sm:ml-2 sm:mt-0"
                                    >
                                        <div className="text-[11px] font-semibold leading-snug">
                                            {lvl.title}{" "}
                                            <span className="font-normal text-slate-400">({lvl.english})</span>
                                        </div>
                                        <p className="text-[11px] leading-snug text-slate-200 mt-0.5">{lvl.description}</p>
                                        {/* Arrow — points left toward the option on sm+ */}
                                        <span className="hidden sm:block absolute right-full top-3 border-[6px] border-transparent border-r-slate-900" />
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
