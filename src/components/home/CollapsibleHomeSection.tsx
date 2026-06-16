"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";

interface CollapsibleHomeSectionProps {
    eyebrow: string;
    title: string;
    subtitle?: string;
    /** Collapsed by default — the toggle reveals the content. */
    defaultOpen?: boolean;
    children: React.ReactNode;
}

/**
 * Client wrapper that renders a tappable header (eyebrow + title + subtitle)
 * with a chevron toggle, and shows its children only when expanded. Lets a
 * server component (which fetches the data) stay server-side while the
 * collapse interaction lives on the client.
 */
export function CollapsibleHomeSection({
    eyebrow,
    title,
    subtitle,
    defaultOpen = false,
    children,
}: CollapsibleHomeSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="w-full flex items-center justify-between gap-3 text-left group"
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-brand-primary text-xs font-bold uppercase tracking-wide">
                        <Sparkles className="w-4 h-4" />
                        {eyebrow}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 mt-1">
                        {title}
                    </h2>
                    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
                </div>
                <span className="flex-shrink-0 flex items-center gap-2 text-sm text-slate-500 group-hover:text-brand-primary transition-colors">
                    <span className="hidden sm:inline">{open ? "Sembunyikan" : "Tampilkan"}</span>
                    <ChevronDown
                        className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                </span>
            </button>
            {open && <div className="mt-4">{children}</div>}
        </section>
    );
}
