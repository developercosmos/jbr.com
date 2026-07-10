"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OPTIONS = [
    { value: "ALL", label: "Semua" },
    { value: "NEW", label: "Baru" },
    { value: "PRELOVED", label: "Pre-loved" },
] as const;

/**
 * Condition filter for the home "Featured Listings". Writes ?condition= into the URL;
 * the server ProductGrid reads it and queries getPublishedProducts(..., condition).
 * Previously a stray control existed but nothing fed the grid, so it never filtered.
 */
export function FeaturedConditionFilter({ value }: { value: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const onChange = (next: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === "ALL") params.delete("condition");
        else params.set("condition", next);
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}#featured` : `${pathname}#featured`);
    };

    return (
        <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-500">Kondisi</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-brand-primary focus:outline-none"
            >
                {OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </label>
    );
}
