"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Lock, Mail, Loader2, AlertCircle, Send } from "lucide-react";
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

// Google (and most OAuth providers) reject a redirect_uri whose host is a raw IP
// literal — only loopback (localhost / 127.0.0.1) is allowed. So when the app is
// opened via a private LAN IP (e.g. http://192.168.1.225:3000), the Google flow
// fails with "device_id and device_name are required for private IP". In that
// case we hand the sign-in off to the canonical public domain instead.
function isOAuthUnsafeHost(hostname: string): boolean {
    const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
    const isLoopback = hostname === "127.0.0.1" || hostname === "::1" || hostname === "localhost";
    return isIpLiteral && !isLoopback;
}

const CANONICAL_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com").replace(/\/+$/, "");

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    const [resendSuccess, setResendSuccess] = useState(false);
    const [oauthUnsafe, setOauthUnsafe] = useState(false);
    const submitLockRef = useRef(false);
    const tiktokEnabled = process.env.NEXT_PUBLIC_ENABLE_TIKTOK_LOGIN === "true";

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitLockRef.current || loading) {
            return;
        }

        submitLockRef.current = true;
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
                // Hard redirect so the session cookie is picked up on a fresh page load.
                // Keep submitLockRef = true so no re-submission fires while navigating.
                window.location.href = callbackUrl;
                return;
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
            submitLockRef.current = false;
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

    const handleSocialLogin = async (provider: "google" | "tiktok") => {
        setError("");

        // On a private-IP host the OAuth redirect_uri would be a private IP, which
        // Google rejects. Continue the flow on the canonical public domain (same
        // app + DB) where the registered redirect URI is valid.
        if (oauthUnsafe) {
            try {
                const current = new URLSearchParams(window.location.search);
                const cb = current.get("callbackUrl") || current.get("redirect");
                const target = new URL("/auth/login", CANONICAL_ORIGIN);
                if (cb) target.searchParams.set("callbackUrl", cb);
                target.searchParams.set("sso", provider);
                if (target.origin !== window.location.origin) {
                    setLoading(true);
                    window.location.href = target.toString();
                    return;
                }
            } catch {
                // fall through to the explanatory error
            }
            setError(
                `Login Google/TikTok tidak bisa dipakai saat membuka situs lewat alamat IP. Gunakan email & password, atau buka ${CANONICAL_ORIGIN}.`
            );
            return;
        }

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

    // Detect IP-literal hosts (where Google OAuth is blocked) and, if we were
    // bounced here from such a host to finish social sign-in, resume it now.
    useEffect(() => {
        const unsafe = isOAuthUnsafeHost(window.location.hostname);
        setOauthUnsafe(unsafe);
        if (unsafe) return;

        const params = new URLSearchParams(window.location.search);
        const sso = params.get("sso");
        if (sso === "google" || sso === "tiktok") {
            // Strip ?sso so a refresh/back doesn't re-trigger the redirect.
            params.delete("sso");
            const qs = params.toString();
            window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
            setLoading(true);
            const searchParams = new URLSearchParams(window.location.search);
            const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl") || searchParams.get("redirect"));
            void signIn
                .social({ provider: sso, callbackURL: callbackUrl })
                .catch(() => {
                    setError("Terjadi kesalahan. Silakan coba lagi.");
                    setLoading(false);
                });
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black/20 p-4">
            <div className="max-w-md w-full bg-white dark:bg-surface-dark rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Link href="/" className="flex items-center gap-2.5" aria-label="JualBeliRaket.com — Beranda">
                        <Image
                            src="/brand/jr.png"
                            alt="JualBeliRaket"
                            width={438}
                            height={200}
                            priority
                            className="h-11 w-auto"
                        />
                        <Image
                            src="/brand/jualbeliraket.png"
                            alt="JualBeliRaket.com"
                            width={697}
                            height={128}
                            priority
                            className="h-7 w-auto"
                        />
                    </Link>
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

                {/* Notice when opened via a raw IP (Google OAuth blocks private IPs) */}
                {oauthUnsafe && (
                    <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>
                            Anda membuka situs lewat alamat IP, jadi login Google/TikTok akan dilanjutkan di
                            domain resmi{" "}
                            <span className="font-semibold">{CANONICAL_ORIGIN.replace(/^https?:\/\//, "")}</span>.
                            Untuk tetap di sini, gunakan email &amp; password.
                        </span>
                    </div>
                )}

                {/* Social Login */}
                <div className={`grid gap-4 ${tiktokEnabled ? "grid-cols-2" : "grid-cols-1"}`}>
                    <button
                        type="button"
                        onClick={() => handleSocialLogin("google")}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors font-medium text-slate-700 dark:text-slate-300 text-sm disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
                            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
                        </svg>
                        Google
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

