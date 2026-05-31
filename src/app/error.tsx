"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

// Route-segment error boundary for the app. Catches render/data errors below the
// root layout and offers recovery without a full reload.
export default function Error({
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
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Terjadi kesalahan
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-500">
                Maaf, halaman ini gagal dimuat. Anda bisa mencoba lagi atau kembali ke beranda.
            </p>
            <div className="mt-6 flex gap-3">
                <button
                    onClick={() => reset()}
                    className="rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
                >
                    Coba lagi
                </button>
                <Link
                    href="/"
                    className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                    Ke Beranda
                </Link>
            </div>
        </div>
    );
}
