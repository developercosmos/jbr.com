"use client";

import { useEffect } from "react";

/**
 * Triggers the browser print dialog when the page mounts (if `?auto=1` query param).
 * The user prints to PDF via the browser's native "Save as PDF" option — no server-side
 * PDF dependency is required and the resulting file uses native font rendering.
 */
export default function AutoPrint({ enabled }: { enabled: boolean }) {
    useEffect(() => {
        if (!enabled) return;
        const t = setTimeout(() => {
            try {
                window.print();
            } catch {
                // ignore
            }
        }, 400);
        return () => clearTimeout(t);
    }, [enabled]);
    return null;
}
