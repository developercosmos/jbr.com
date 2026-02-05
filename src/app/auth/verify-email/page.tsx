"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";

function VerifyEmailContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("Token verifikasi tidak ditemukan.");
            return;
        }

        const verifyEmail = async () => {
            try {
                const result = await authClient.verifyEmail({ query: { token } });

                if (result.error) {
                    setStatus("error");
                    setMessage(result.error.message || "Verifikasi gagal.");
                } else {
                    setStatus("success");
                    setMessage("Email Anda berhasil diverifikasi!");
                }
            } catch (error: any) {
                setStatus("error");
                setMessage(error.message || "Terjadi kesalahan saat verifikasi.");
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
            {status === "loading" && (
                <>
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Memverifikasi Email...
                    </h1>
                    <p className="text-slate-500">
                        Mohon tunggu sebentar.
                    </p>
                </>
            )}

            {status === "success" && (
                <>
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-full">
                            <CheckCircle className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Email Terverifikasi!
                    </h1>
                    <p className="text-slate-500 mb-6">
                        {message}
                    </p>
                    <Link
                        href="/auth/login"
                        className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors"
                    >
                        Masuk ke Akun
                    </Link>
                </>
            )}

            {status === "error" && (
                <>
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
                            <XCircle className="w-12 h-12 text-red-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        Verifikasi Gagal
                    </h1>
                    <p className="text-slate-500 mb-6">
                        {message}
                    </p>
                    <div className="space-y-3">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors"
                        >
                            Kembali ke Login
                        </Link>
                        <p className="text-sm text-slate-400">
                            Token mungkin sudah kedaluwarsa atau sudah digunakan.
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

function LoadingFallback() {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 text-center">
            <div className="flex justify-center mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                </div>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Memuat...
            </h1>
        </div>
    );
}

export default function VerifyEmailPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
            <div className="max-w-md w-full">
                <Suspense fallback={<LoadingFallback />}>
                    <VerifyEmailContent />
                </Suspense>

                <p className="text-center text-sm text-slate-400 mt-6">
                    <Link href="/" className="hover:text-brand-primary transition-colors">
                        ← Kembali ke Beranda
                    </Link>
                </p>
            </div>
        </div>
    );
}
