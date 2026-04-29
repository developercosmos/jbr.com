"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Star } from "lucide-react";
import { openBuyerRatingDispute, submitBuyerInteractionRating } from "@/actions/reputation";

const BEHAVIOR_TAGS = [
    { value: "EXTREME_LOWBALL", label: "Lowball Ekstrem" },
    { value: "NO_FOLLOW_UP", label: "Tidak Follow-up" },
    { value: "GHOSTING", label: "Ghosting" },
    { value: "RUDE_COMMUNICATION", label: "Komunikasi Buruk" },
    { value: "TIMELY_AND_COMMUNICATIVE", label: "Respon Baik" },
    { value: "FAIR_NEGOTIATOR", label: "Negosiator Wajar" },
] as const;

type BehaviorTag = (typeof BEHAVIOR_TAGS)[number]["value"];

interface ExistingRating {
    id: string;
    rating: number;
    tags: string[];
    note: string | null;
    is_disputed: boolean;
    edited_until: string | Date;
}

interface BuyerInteractionRatingCardProps {
    orderId: string;
    buyerId: string;
    buyerName: string;
    existing: ExistingRating | null;
}

export default function BuyerInteractionRatingCard({
    orderId,
    buyerId,
    buyerName,
    existing,
}: BuyerInteractionRatingCardProps) {
    const router = useRouter();
    const [rating, setRating] = useState<number>(existing?.rating ?? 0);
    const [tags, setTags] = useState<BehaviorTag[]>(() =>
        (existing?.tags ?? []).filter((tag): tag is BehaviorTag =>
            BEHAVIOR_TAGS.some((item) => item.value === tag)
        )
    );
    const [note, setNote] = useState(existing?.note ?? "");
    const [disputeReason, setDisputeReason] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isDisputeMode, setIsDisputeMode] = useState(false);
    const [isPending, startTransition] = useTransition();

    const isEditWindowOpen = existing
        ? new Date(existing.edited_until).getTime() > Date.now()
        : true;

    function toggleTag(value: BehaviorTag) {
        setTags((prev) =>
            prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
        );
    }

    function handleSubmit() {
        setError(null);
        setSuccess(null);

        if (rating < 1 || rating > 5) {
            setError("Pilih rating 1 sampai 5.");
            return;
        }

        startTransition(async () => {
            try {
                await submitBuyerInteractionRating({
                    contextType: "ORDER",
                    contextId: orderId,
                    buyerId,
                    rating,
                    tags,
                    note: note.trim() || undefined,
                });
                setSuccess("Penilaian buyer berhasil disimpan.");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal menyimpan penilaian buyer.");
            }
        });
    }

    function handleOpenDispute() {
        setError(null);
        setSuccess(null);
        if (!existing?.id) return;
        if (disputeReason.trim().length < 8) {
            setError("Alasan sengketa minimal 8 karakter.");
            return;
        }

        startTransition(async () => {
            try {
                await openBuyerRatingDispute({
                    interactionRatingId: existing.id,
                    reason: disputeReason.trim(),
                });
                setSuccess("Sengketa rating berhasil dibuat dan masuk ke admin disputes.");
                setDisputeReason("");
                setIsDisputeMode(false);
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal membuat sengketa rating.");
            }
        });
    }

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
            <h2 className="font-bold text-slate-900 dark:text-white mb-1">Penilaian Pembeli</h2>
            <p className="text-sm text-slate-500 mb-4">
                Nilai kualitas interaksi buyer {buyerName || "ini"} untuk penguatan trust score.
            </p>

            {!isEditWindowOpen && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Periode edit 24 jam telah berakhir untuk konteks pesanan ini.
                </div>
            )}

            <div className="flex items-center gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, idx) => {
                    const value = idx + 1;
                    return (
                        <button
                            key={value}
                            type="button"
                            disabled={!isEditWindowOpen || isPending}
                            onClick={() => setRating(value)}
                            className="p-1"
                            aria-label={`Beri ${value} bintang`}
                        >
                            <Star
                                className={`w-7 h-7 ${
                                    value <= rating
                                        ? "fill-amber-500 text-amber-500"
                                        : "text-slate-300 hover:text-amber-300"
                                }`}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {BEHAVIOR_TAGS.map((tag) => {
                    const active = tags.includes(tag.value);
                    return (
                        <button
                            key={tag.value}
                            type="button"
                            disabled={!isEditWindowOpen || isPending}
                            onClick={() => toggleTag(tag.value)}
                            className={`text-xs px-3 py-1 rounded-full border ${
                                active
                                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                    : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                        >
                            {tag.label}
                        </button>
                    );
                })}
            </div>

            <textarea
                rows={3}
                value={note}
                disabled={!isEditWindowOpen || isPending}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                placeholder="Catatan tambahan (opsional, maks 500 karakter)..."
                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isEditWindowOpen || isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                >
                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Penilaian
                </button>
                {existing && (
                    <button
                        type="button"
                        onClick={() => setIsDisputeMode((v) => !v)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-sm font-semibold"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        {isDisputeMode ? "Batalkan Sengketa" : "Ajukan Sengketa"}
                    </button>
                )}
            </div>

            {isDisputeMode && existing && (
                <div className="mt-4 space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <textarea
                        rows={2}
                        value={disputeReason}
                        onChange={(event) => setDisputeReason(event.target.value)}
                        maxLength={1200}
                        placeholder="Alasan sengketa rating..."
                        className="block w-full px-3 py-2 border border-rose-200 rounded-lg bg-white text-slate-900 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <button
                        type="button"
                        onClick={handleOpenDispute}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                    >
                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Kirim Sengketa
                    </button>
                </div>
            )}

            {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
            {success && <p className="mt-3 text-xs text-emerald-600">{success}</p>}
        </div>
    );
}
