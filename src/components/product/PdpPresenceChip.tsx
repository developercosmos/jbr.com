"use client";

import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";

const POLL_INTERVAL_MS = 15_000;

function getOrCreateSessionId(): string {
    if (typeof window === "undefined") return "";
    try {
        let id = window.sessionStorage.getItem("__jbr_pdp_session");
        if (!id) {
            id = `s_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
            window.sessionStorage.setItem("__jbr_pdp_session", id);
        }
        return id;
    } catch {
        return `t_${Date.now()}`;
    }
}

interface Props {
    productId: string;
    /** Set to "bidding" when buyer focuses the offer input. */
    intent?: "view" | "bidding";
}

/**
 * DIF-08: Live presence chip on PDP. Polls /api/pdp/[id]/presence every 15s
 * AND posts heartbeat ping with same cadence so server knows we're still here.
 *
 * Pauses when document hidden (saves Postgres writes for background tabs).
 */
export function PdpPresenceChip({ productId, intent = "view" }: Props) {
    const [label, setLabel] = useState<string | null>(null);
    const sessionRef = useRef<string>("");

    useEffect(() => {
        sessionRef.current = getOrCreateSessionId();
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;

        async function tick() {
            if (cancelled) return;
            if (typeof document !== "undefined" && document.hidden) {
                timer = setTimeout(tick, POLL_INTERVAL_MS);
                return;
            }
            try {
                const res = await fetch(`/api/pdp/${productId}/presence`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ sessionId: sessionRef.current, intent }),
                    cache: "no-store",
                });
                if (res.ok) {
                    const data = (await res.json()) as { label: string | null };
                    if (!cancelled) setLabel(data.label);
                }
            } catch {
                // silent — presence is best-effort
            }
            timer = setTimeout(tick, POLL_INTERVAL_MS);
        }

        void tick();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [productId, intent]);

    if (!label) return null;

    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
            <Eye className="w-3.5 h-3.5" />
            <span>{label}</span>
        </div>
    );
}
