import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSellerProfileByUserId } from "@/actions/seller";
import { canAccessSellerCenter } from "@/lib/seller";
import { getSellerFunnel, getSellerTopProducts } from "@/actions/product-events";
import { getSellerSearchTerms } from "@/actions/search-terms";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ range?: string }>;
}

function isoDay(offset = 0) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
}

const RANGE_OPTIONS = [
    { value: "7", label: "7 Hari" },
    { value: "30", label: "30 Hari" },
    { value: "90", label: "90 Hari" },
];

export default async function SellerFunnelPage({ searchParams }: PageProps) {
    const params = await searchParams;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect("/auth/login?redirect=/seller/analytics/funnel");

    const profile = await getSellerProfileByUserId(session.user.id);
    if (!profile?.store_slug || !canAccessSellerCenter(profile.store_status)) {
        redirect("/seller/register");
    }

    const range = Number(params.range || 30);
    const startDate = isoDay(-range);
    const endDate = isoDay(0);

    const [funnel, topProducts, searchTerms] = await Promise.all([
        getSellerFunnel(session.user.id, startDate, endDate),
        getSellerTopProducts(session.user.id, startDate, endDate, 10),
        getSellerSearchTerms(session.user.id, startDate, endDate, 25),
    ]);

    const stages = [
        { key: "IMPRESSION", label: "Impression" },
        { key: "CLICK", label: "Click" },
        { key: "ADD_TO_CART", label: "Add to Cart" },
        { key: "CHECKOUT_START", label: "Checkout" },
        { key: "PURCHASE", label: "Purchase" },
    ] as const;

    const max = Math.max(funnel.IMPRESSION || 1, 1);

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                    <Link href="/seller/analytics" className="text-slate-500 hover:text-brand-primary">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase">
                            Conversion Funnel
                        </h1>
                        <p className="text-sm text-slate-500">
                            {startDate} → {endDate}. Pakai untuk identifikasi tahap mana yang paling banyak buyer drop.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {RANGE_OPTIONS.map((opt) => (
                        <Link
                            key={opt.value}
                            href={`/seller/analytics/funnel?range=${opt.value}`}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                                String(range) === opt.value
                                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                    : "border-slate-200 text-slate-600 hover:border-brand-primary/50"
                            }`}
                        >
                            {opt.label}
                        </Link>
                    ))}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
                    <h2 className="font-bold text-slate-900">Funnel</h2>
                    {stages.map((stage, idx) => {
                        const count = funnel[stage.key] || 0;
                        const widthPct = Math.max(2, Math.round((count / max) * 100));
                        const prev = idx > 0 ? funnel[stages[idx - 1].key] || 0 : count;
                        const conversion = prev > 0 ? Math.round((count / prev) * 1000) / 10 : 0;
                        return (
                            <div key={stage.key} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-slate-700">{stage.label}</span>
                                    <span className="font-mono text-slate-900">{count.toLocaleString("id-ID")}</span>
                                </div>
                                <div className="relative h-7 rounded-md bg-slate-100 overflow-hidden">
                                    <div
                                        className="absolute inset-y-0 left-0 bg-brand-primary/80"
                                        style={{ width: `${widthPct}%` }}
                                    />
                                </div>
                                {idx > 0 && (
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        {conversion >= 50 ? (
                                            <TrendingUp className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                            <TrendingDown className="w-3 h-3 text-rose-500" />
                                        )}
                                        Konversi dari {stages[idx - 1].label}: {conversion}%
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                        <h2 className="font-bold text-slate-900">Top Produk berdasarkan Pesanan</h2>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <th className="text-left p-3">Produk</th>
                                <th className="text-right p-3">Impression</th>
                                <th className="text-right p-3">Click</th>
                                <th className="text-right p-3">Cart</th>
                                <th className="text-right p-3">Pesanan</th>
                                <th className="text-right p-3">Konversi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-6 text-center text-slate-400">
                                        Belum ada event tercatat untuk rentang ini.
                                    </td>
                                </tr>
                            ) : (
                                topProducts.map((p) => {
                                    const conv = p.impressions > 0 ? Math.round((p.purchases / p.impressions) * 10000) / 100 : 0;
                                    return (
                                        <tr key={p.productId} className="border-t border-slate-100">
                                            <td className="p-3">
                                                <Link href={`/product/${p.slug}`} className="font-medium text-slate-900 hover:text-brand-primary">
                                                    {p.title}
                                                </Link>
                                            </td>
                                            <td className="p-3 text-right font-mono">{p.impressions.toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right font-mono">{p.clicks.toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right font-mono">{p.addToCart.toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right font-mono font-semibold">{p.purchases.toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right font-mono">{conv.toFixed(2)}%</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-5 border-b border-slate-200">
                        <h2 className="font-bold text-slate-900">Search Terms yang Mendarat ke Toko Anda</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Kata kunci yang digunakan pembeli sebelum klik ke listing toko Anda.
                        </p>
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-xs text-slate-500 uppercase">
                                <th className="text-left p-3">Term</th>
                                <th className="text-right p-3">Impression</th>
                                <th className="text-right p-3">Klik</th>
                                <th className="text-right p-3">CTR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {searchTerms.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-6 text-center text-slate-400">
                                        Belum ada search term tercatat untuk rentang ini.
                                    </td>
                                </tr>
                            ) : (
                                searchTerms.map((row) => {
                                    const ctr = Number(row.impressions) > 0 ? Math.round((Number(row.clicks) / Number(row.impressions)) * 10000) / 100 : 0;
                                    return (
                                        <tr key={row.term} className="border-t border-slate-100">
                                            <td className="p-3 font-mono">{row.term}</td>
                                            <td className="p-3 text-right">{Number(row.impressions).toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right">{Number(row.clicks).toLocaleString("id-ID")}</td>
                                            <td className="p-3 text-right">{ctr.toFixed(2)}%</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
