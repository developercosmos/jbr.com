"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Top-level error boundary. Catches errors thrown in the root layout/render and
// replaces the whole document (so it must render its own <html>/<body>).
export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="id">
            <body
                style={{
                    fontFamily: "system-ui, sans-serif",
                    display: "flex",
                    minHeight: "100vh",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: 0,
                    background: "#f8fafc",
                    color: "#0f172a",
                }}
            >
                <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
                    <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                        Terjadi kesalahan
                    </h1>
                    <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>
                        Maaf, terjadi kendala tak terduga. Tim kami sudah diberi tahu.
                    </p>
                    <button
                        onClick={() => reset()}
                        style={{
                            background: "#2563eb",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            padding: "10px 20px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        Coba lagi
                    </button>
                </div>
            </body>
        </html>
    );
}
