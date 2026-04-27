"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { submitBuyerRating } from "@/actions/reputation";

interface ExistingRating {
    rating: number;
    tags: string[] | null;
    comment: string | null;
    submitted_at: Date | string;
}

interface Props {
    orderId: string;
    role: "buyer" | "seller";
    existing: ExistingRating | null;
    revealedOpposite: ExistingRating | null;
    revealed: boolean;
    submissionWindowOpen: boolean;
}

const BUYER_TAGS = ["Komunikatif", "Bayar Cepat", "Sopan", "Pickup Lancar"];
const SELLER_TAGS = ["Respon Cepat", "Pengemasan Baik", "Sesuai Deskripsi", "Layanan Ramah"];

export default function CounterpartyRating({
    orderId,
    role,
    existing,
    revealedOpposite,
    revealed,
    submissionWindowOpen,
}: Props) {
    const router = useRouter();
    const tagOptions = role === "seller" ? BUYER_TAGS : SELLER_TAGS;
    const [rating, setRating] = useState<number>(existing?.rating ?? 0);
    const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
    const [comment, setComment] = useState<string>(existing?.comment ?? "");
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const heading = role === "seller"
        ? "Beri Rating untuk Pembeli"
        : "Beri Rating untuk Penjual";

    function toggleTag(tag: string) {
        setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
    }

    function handleSubmit() {
        setError(null);
        if (rating < 1 || rating > 5) {
            setError("Pilih bintang antara 1-5.");
            return;
        }
        startTransition(async () => {
            try {
                await submitBuyerRating({
                    orderId,
                    rating,
                    tags: tags.length > 0 ? tags : undefined,
                    comment: comment.trim() || undefined,
                });
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengirim rating.");
            }
        });
    }

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white">{heading}</h3>
            </div>
            <div className="p-5 space-y-4">
                {existing ? (
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < existing.rating ? "fill-amber-500 text-amber-500" : "text-slate-300"}`}
                                />
                            ))}
                            <span className="ml-2 text-xs text-slate-500">Rating Anda telah tercatat.</span>
                        </div>
                        {existing.tags && existing.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {existing.tags.map((t) => (
                                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{t}</span>
                                ))}
                            </div>
                        )}
                        {existing.comment && <p className="text-xs">{existing.comment}</p>}
                    </div>
                ) : !submissionWindowOpen ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Masa pemberian rating untuk pesanan ini sudah berakhir.
                    </p>
                ) : (
                    <>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => {
                                const value = i + 1;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-label={`Beri ${value} bintang`}
                                        onClick={() => setRating(value)}
                                        className="p-1"
                                    >
                                        <Star
                                            className={`w-7 h-7 ${value <= rating ? "fill-amber-500 text-amber-500" : "text-slate-300 hover:text-amber-300"}`}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {tagOptions.map((tag) => {
                                const active = tags.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => toggleTag(tag)}
                                        className={`text-xs px-3 py-1 rounded-full border ${
                                            active
                                                ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                                : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-primary/50"
                                        }`}
                                    >
                                        {tag}
                                    </button>
                                );
                            })}
                        </div>
                        <textarea
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            maxLength={500}
                            placeholder="Tulis pengalaman Anda (opsional, maks 500 karakter)..."
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                        {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                        >
                            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Kirim Rating
                        </button>
                    </>
                )}

                {revealedOpposite && (
                    <div className="border-t border-slate-200 dark:border-slate-800 pt-4 text-sm">
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                            Rating dari pihak lain
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                    key={i}
                                    className={`w-4 h-4 ${i < revealedOpposite.rating ? "fill-amber-500 text-amber-500" : "text-slate-300"}`}
                                />
                            ))}
                        </div>
                        {revealedOpposite.tags && revealedOpposite.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-1">
                                {revealedOpposite.tags.map((t) => (
                                    <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{t}</span>
                                ))}
                            </div>
                        )}
                        {revealedOpposite.comment && <p className="text-xs">{revealedOpposite.comment}</p>}
                    </div>
                )}

                {!revealed && existing && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800 pt-3">
                        Rating dari pihak lain akan terungkap setelah keduanya mengirim atau setelah masa rating berakhir.
                    </p>
                )}
            </div>
        </div>
    );
}
