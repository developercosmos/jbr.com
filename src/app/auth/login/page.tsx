"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Zap, ArrowRight, Lock, Mail, Loader2, AlertCircle, Send } from "lucide-react";
import { signIn } from "@/lib/auth-client";

function getSafeCallbackUrl(value: string | null): string {
    if (!value) {
        return "/";
    }

    let decoded = value;
    try {
        decoded = decodeURIComponent(value);
    } catch {
        decoded = value;
    }

    // Allow only same-site relative URLs.
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
        return decoded;
    }

    return "/";
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const tiktokEnabled = process.env.NEXT_PUBLIC_ENABLE_TIKTOK_LOGIN === "true";

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setNeedsVerification(false);
        setResendSuccess(false);
        setLoading(true);

        try {
            const result = await signIn.email({
                email,
                password,
            });

            if (result.error) {
                const errorMessage = result.error.message || "";
                // Check if it's an email verification error
                if (errorMessage.toLowerCase().includes("verif") || errorMessage.toLowerCase().includes("verified")) {
                    setNeedsVerification(true);
                    setError("Email Anda belum terverifikasi. Silakan cek inbox email Anda.");
                } else {
                    setError(errorMessage || "Login gagal. Silakan coba lagi.");
                }
            } else {
                const searchParams = new URLSearchParams(window.location.search);
                const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl") || searchParams.get("redirect"));
                router.push(callbackUrl);
                router.refresh();
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!email) {
            setError("Masukkan email Anda terlebih dahulu.");
            return;
        }

        setResendLoading(true);
        setError("");

        try {
            // Call the API to resend verification email
            const response = await fetch("/api/auth/resend-verification", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            if (response.ok) {
                setResendSuccess(true);
                setNeedsVerification(false);
            } else {
                const data = await response.json();
                setError(data.error || "Gagal mengirim email verifikasi.");
            }
        } catch {
            setError("Gagal mengirim email verifikasi.");
        } finally {
            setResendLoading(false);
        }
    };

    const handleSocialLogin = async (provider: "instagram" | "tiktok") => {
        setError("");
        setLoading(true);

        try {
            const searchParams = new URLSearchParams(window.location.search);
            const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl") || searchParams.get("redirect"));
            await signIn.social({
                provider,
                callbackURL: callbackUrl,
            });
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black/20 p-4">
            <div className="max-w-md w-full bg-white dark:bg-surface-dark rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="flex items-center gap-2">
                        <div className="size-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/25">
                            <Zap className="text-white w-6 h-6 fill-current" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight font-heading text-slate-900 dark:text-white">
                            JUALBELIRAKET
                        </span>
                    </div>
                </div>

                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Selamat Datang Kembali!
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Masuk untuk mengakses akun Anda dan mulai bertransaksi.
                    </p>
                </div>

                {/* Resend Success Message */}
                {resendSuccess && (
                    <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-start gap-2">
                        <Send className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium">Email verifikasi terkirim!</p>
                            <p className="text-sm text-green-600">Silakan cek inbox email Anda untuk link verifikasi.</p>
                        </div>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p>{error}</p>
                                {needsVerification && (
                                    <button
                                        type="button"
                                        onClick={handleResendVerification}
                                        disabled={resendLoading}
                                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-800 hover:text-red-900 underline disabled:opacity-50"
                                    >
                                        {resendLoading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Mengirim...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Kirim Ulang Email Verifikasi
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleEmailLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-white">
                            Email Address
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="nama@email.com"
                                autoComplete="username"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-slate-900 dark:text-white">
                                Password
                            </label>
                            <Link href="/auth/forgot-password" className="text-xs font-bold text-brand-primary hover:underline">
                                Lupa Password?
                            </Link>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-brand-primary/25 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <>
                                Masuk Sekarang
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white dark:bg-surface-dark text-slate-500">
                            Atau masuk dengan
                        </span>
                    </div>
                </div>

                {/* Social Login */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => handleSocialLogin("instagram")}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium text-slate-700 dark:text-slate-300 text-sm disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                            <defs>
                                <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#F58529" />
                                    <stop offset="35%" stopColor="#DD2A7B" />
                                    <stop offset="70%" stopColor="#8134AF" />
                                    <stop offset="100%" stopColor="#515BD4" />
                                </linearGradient>
                            </defs>
                            <path fill="url(#ig-gradient)" d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 1.8A3.7 3.7 0 0 0 3.8 7.5v9a3.7 3.7 0 0 0 3.7 3.7h9a3.7 3.7 0 0 0 3.7-3.7v-9a3.7 3.7 0 0 0-3.7-3.7h-9Zm9.7 1.3a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
                        </svg>
                        Instagram
                    </button>
                    {tiktokEnabled && (
                        <button
                            type="button"
                            onClick={() => handleSocialLogin("tiktok")}
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium text-slate-700 dark:text-slate-300 text-sm disabled:opacity-50"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                                <path
                                    fill="currentColor"
                                    d="M17.5 3c.3 1.8 1.4 3.2 3.1 4 .5.2 1 .4 1.4.4V11c-1.7 0-3.4-.5-4.8-1.4v5.9c0 3.1-2.5 5.5-5.6 5.5S6 18.6 6 15.5 8.5 10 11.6 10c.3 0 .6 0 .9.1v3.4a2.1 2.1 0 0 0-.9-.2c-1.2 0-2.2 1-2.2 2.2s1 2.2 2.2 2.2 2.2-1 2.2-2.2V3h3.7Z"
                                />
                            </svg>
                            TikTok
                        </button>
                    )}
                </div>

                {/* Footer */}
                <p className="mt-8 text-center text-sm text-slate-500">
                    Belum punya akun?{" "}
                    <Link href="/auth/register" className="font-bold text-brand-primary hover:underline">
                        Daftar Sekarang
                    </Link>
                </p>
            </div>
        </div>
    );
}

