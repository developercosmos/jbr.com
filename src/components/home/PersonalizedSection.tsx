import Link from "next/link";
import Image from "next/image";
import { Sparkles, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getRecommendedRackets } from "@/actions/niche";
import { CollapsibleHomeSection } from "./CollapsibleHomeSection";

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

/**
 * REC-01: "Cocok untuk Anda" — server component that surfaces personalized
 * listings derived from player_profiles (NICHE-05). Renders nothing for
 * anonymous users so the home page above-the-fold stays clean.
 */
export async function PersonalizedSection() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;

    const result = await getRecommendedRackets(session.user.id, 8);
    if (!result.recommendations || result.recommendations.length === 0) {
        return (
            <CollapsibleHomeSection
                eyebrow="Cocok untuk Anda"
                title="Rekomendasi sesuai gaya main Anda"
                subtitle="Lengkapi profil pemain untuk saran raket personal."
            >
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-brand-primary" />
                    <h3 className="font-bold text-slate-900">Dapatkan rekomendasi raket personal</h3>
                    <p className="text-sm text-slate-500 mt-1 mb-3">
                        Lengkapi profil pemain dalam 1 menit untuk mendapat saran raket sesuai gaya main Anda.
                    </p>
                    <Link
                        href="/profile/player"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors"
                    >
                        Lengkapi Profil <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </CollapsibleHomeSection>
        );
    }

    return (
        <CollapsibleHomeSection
            eyebrow="Cocok untuk Anda"
            title="Rekomendasi sesuai gaya main Anda"
            subtitle={result.explanation}
        >
            <div className="flex justify-end mb-3">
                <Link href="/search" className="text-sm text-brand-primary hover:underline font-medium">
                    Lihat semua →
                </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {result.recommendations.map((p) => (
                    <Link
                        key={p.id}
                        href={`/product/${p.slug}`}
                        className="group bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-brand-primary hover:shadow-sm transition-all"
                    >
                        <div className="relative aspect-square bg-slate-100">
                            {p.images && p.images[0] ? (
                                <Image
                                    src={p.images[0]}
                                    alt={p.title}
                                    fill
                                    sizes="(max-width: 640px) 50vw, 25vw"
                                    className="object-cover group-hover:scale-105 transition-transform"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">No image</div>
                            )}
                        </div>
                        <div className="p-3">
                            <h3 className="text-sm font-medium text-slate-900 line-clamp-2 group-hover:text-brand-primary transition-colors">
                                {p.title}
                            </h3>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                                {p.weight_class && <span className="px-1.5 py-0.5 rounded bg-slate-100">{p.weight_class}</span>}
                                {p.balance && <span className="px-1.5 py-0.5 rounded bg-slate-100">{p.balance.replace("_", " ")}</span>}
                                {p.shaft_flex && <span className="px-1.5 py-0.5 rounded bg-slate-100">{p.shaft_flex}</span>}
                            </div>
                            <p className="mt-2 font-bold text-brand-primary">{formatPrice(p.price)}</p>
                        </div>
                    </Link>
                ))}
            </div>
        </CollapsibleHomeSection>
    );
}
