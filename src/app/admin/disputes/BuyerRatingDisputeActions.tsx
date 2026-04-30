"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2 } from "lucide-react";
import { moderateBuyerInteractionRating } from "@/actions/reputation";
import { updateDisputeStatus } from "@/actions/admin";

interface Props {
    disputeId: string;
    targetRatingId: string | null;
    currentStatus: string;
}

/**
 * PDP-10: Admin moderation actions for BUYER_RATING disputes.
 *
 * Two-step lifecycle:
 *   1. Open → IN_PROGRESS (admin acknowledges, takes ownership).
 *   2. IN_PROGRESS → RESOLVED with verdict:
 *      - VALID  → keep rating, close dispute (no recompute needed).
 *      - INVALID → invalidate rating + recompute buyer reputation.
 */
export function BuyerRatingDisputeActions({ disputeId, targetRatingId, currentStatus }: Props) {
    const router = useRouter();
    const [reason, setReason] = useState("");
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const canResolve = currentStatus === "IN_PROGRESS" || currentStatus === "OPEN" || currentStatus === "AWAITING_RESPONSE";

    function handleVerdict(invalidated: boolean) {
        setError(null);
        if (!targetRatingId) {
            setError("Rating target tidak ditemukan untuk dispute ini.");
            return;
        }
        if (reason.trim().length < 5) {
            setError("Alasan minimal 5 karakter.");
            return;
        }

        startTransition(async () => {
            try {
                await moderateBuyerInteractionRating({
                    interactionRatingId: targetRatingId,
                    invalidated,
                    reason: reason.trim(),
                });
                await updateDisputeStatus(
                    disputeId,
                    "RESOLVED",
                    invalidated
                        ? `Rating dinyatakan tidak valid: ${reason.trim()}`
                        : `Rating dinyatakan valid setelah review: ${reason.trim()}`
                );
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal memutuskan dispute.");
            }
        });
    }

    function handleAcknowledge() {
        startTransition(async () => {
            try {
                await updateDisputeStatus(disputeId, "IN_PROGRESS");
                router.refresh();
            } catch (err) {
                setError(err instanceof Error ? err.message : "Gagal mengubah status.");
            }
        });
    }

    if (!targetRatingId) {
        return (
            <div className="text-xs text-slate-500 italic">
                Rating target dispute ini sudah dihapus / tidak tersedia.
            </div>
        );
    }

    return (
        <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Moderasi Rating Buyer
            </div>

            {currentStatus === "OPEN" && (
                <button
                    type="button"
                    onClick={handleAcknowledge}
                    disabled={isPending}
                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Ambil Alih (set IN_PROGRESS)
                </button>
            )}

            {canResolve && (
                <>
                    <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Alasan keputusan (akan tercatat di audit + appended ke rating note)"
                        rows={3}
                        className="w-full text-sm px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => handleVerdict(false)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Rating Valid
                        </button>
                        <button
                            type="button"
                            onClick={() => handleVerdict(true)}
                            disabled={isPending}
                            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-60"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                            Invalidkan
                        </button>
                    </div>
                </>
            )}

            {error && <div className="text-xs text-rose-600">{error}</div>}
        </div>
    );
}
