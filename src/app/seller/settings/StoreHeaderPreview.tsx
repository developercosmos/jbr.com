"use client";

import Image from "next/image";
import { Star } from "lucide-react";

/**
 * Live, scaled-down mock of the public store header so the seller can see the
 * difference between the overlay and stacked layouts before saving. Reflects the
 * current (unsaved) banner, logo, name, and overlay toggle.
 */
export function StoreHeaderPreview({
    overlay,
    bannerUrl,
    logoUrl,
    storeName,
}: {
    overlay: boolean;
    bannerUrl: string | null;
    logoUrl: string | null;
    storeName: string;
}) {
    const name = storeName?.trim() || "Nama Toko";
    const initial = name.charAt(0).toUpperCase();

    const avatar = (
        <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-white ring-2 ring-white shadow flex items-center justify-center font-bold text-brand-primary">
            {logoUrl ? (
                <Image src={logoUrl} alt={name} fill sizes="40px" className="object-cover" />
            ) : (
                <span className="text-sm">{initial}</span>
            )}
        </div>
    );

    const infoLine = (light: boolean) => (
        <span className={`text-[11px] flex items-center gap-1.5 ${light ? "text-white/85" : "text-slate-500"}`}>
            <span className="inline-flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9
            </span>
            <span>· 12 produk · 1,2RB pengikut</span>
        </span>
    );

    const buttons = (light: boolean) => (
        <div className="flex gap-1.5 shrink-0">
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold ${light ? "bg-white text-slate-900" : "bg-brand-primary text-white"}`}>Ikuti</span>
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-semibold border ${light ? "border-white/70 text-white" : "border-slate-300 text-slate-600"}`}>Chat</span>
        </div>
    );

    return (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">Pratinjau halaman toko</span>
                <span className="text-[10px] font-medium text-slate-400">{overlay ? "Mode: Overlay" : "Mode: Bertumpuk"}</span>
            </div>

            {overlay ? (
                <div className="relative aspect-[12/5] bg-slate-900">
                    {bannerUrl ? (
                        <Image src={bannerUrl} alt="Pratinjau banner" fill sizes="640px" className="object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/50 text-xs">Belum ada banner</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3 flex items-end gap-2">
                        {avatar}
                        <div className="flex-1 min-w-0 text-white">
                            <div className="font-bold text-sm truncate drop-shadow-sm">{name}</div>
                            {infoLine(true)}
                        </div>
                        {buttons(true)}
                    </div>
                </div>
            ) : (
                <div>
                    <div className="relative aspect-[12/5] bg-slate-100">
                        {bannerUrl ? (
                            <Image src={bannerUrl} alt="Pratinjau banner" fill sizes="640px" className="object-contain" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">Belum ada banner</div>
                        )}
                    </div>
                    <div className="p-3 flex items-center gap-2 bg-white border-t border-slate-100">
                        {avatar}
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-slate-900 truncate">{name}</div>
                            {infoLine(false)}
                        </div>
                        {buttons(false)}
                    </div>
                </div>
            )}
        </div>
    );
}
