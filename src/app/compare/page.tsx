import Image from "next/image";
import Link from "next/link";
import { getCompareSet } from "@/actions/niche";

export const dynamic = "force-dynamic";

interface PageProps {
    searchParams: Promise<{ slugs?: string }>;
}

const SPEC_FIELDS: Array<{ key: string; label: string }> = [
    { key: "price", label: "Harga" },
    { key: "condition", label: "Kondisi" },
    { key: "weight_class", label: "Weight" },
    { key: "balance", label: "Balance" },
    { key: "shaft_flex", label: "Shaft" },
    { key: "grip_size", label: "Grip" },
    { key: "max_string_tension_lbs", label: "Max Tension (lbs)" },
    { key: "stiffness_rating", label: "Stiffness" },
];

function formatValue(key: string, product: Record<string, unknown>): string {
    const value = product[key];
    if (value === null || value === undefined || value === "") return "—";
    if (key === "price") {
        return `Rp ${Number(value).toLocaleString("id-ID")}`;
    }
    if (key === "condition" && product.condition_rating) {
        return `${value} ${product.condition_rating}/10`;
    }
    return String(value);
}

export default async function ComparePage({ searchParams }: PageProps) {
    const sp = await searchParams;
    const slugs = (sp.slugs ?? "").split(",").filter(Boolean).slice(0, 3);
    const products = slugs.length > 0 ? await getCompareSet(slugs) : [];

    return (
        <main className="max-w-6xl mx-auto p-8 space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Bandingkan Raket
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Bandingkan hingga 3 raket berdasarkan harga, kondisi, dan spesifikasi teknis.
                </p>
            </div>

            {products.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-slate-500">
                    Tidak ada produk untuk dibandingkan. Tambahkan slug ke URL: <code>?slugs=slug-a,slug-b,slug-c</code>
                </div>
            ) : (
                <div className="overflow-x-auto bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left p-4 font-medium text-slate-500"></th>
                                {products.map((p) => (
                                    <th key={p.id} className="text-left p-4 align-top">
                                        <div className="space-y-2">
                                            {p.images && p.images[0] && (
                                                <div className="relative w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                                    <Image
                                                        src={p.images[0]}
                                                        alt={p.title}
                                                        fill
                                                        className="object-cover"
                                                        sizes="200px"
                                                    />
                                                </div>
                                            )}
                                            <Link
                                                href={`/product/${p.slug}`}
                                                className="font-bold text-slate-900 dark:text-white hover:underline"
                                            >
                                                {p.title}
                                            </Link>
                                            {p.seller && (
                                                <div className="text-xs text-slate-500">
                                                    {p.seller.store_name || p.seller.name}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {SPEC_FIELDS.map((field) => (
                                <tr key={field.key} className="border-t border-slate-200 dark:border-slate-800">
                                    <td className="p-4 text-xs uppercase text-slate-500">{field.label}</td>
                                    {products.map((p) => (
                                        <td key={p.id} className="p-4 text-sm text-slate-900 dark:text-white">
                                            {formatValue(field.key, p as unknown as Record<string, unknown>)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </main>
    );
}
