"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ArrowRight, Lock, Mail, User, Loader2, CheckCircle, MailCheck } from "lucide-react";
import { signUp } from "@/lib/auth-client";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!agreedToTerms) {
            setError("Anda harus menyetujui Syarat & Ketentuan untuk melanjutkan.");
            return;
        }

        if (password.length < 8) {
            setError("Password harus minimal 8 karakter.");
            return;
        }

        setLoading(true);

        try {
            const result = await signUp.email({
                name,
                email,
                password,
            });

            if (result.error) {
                setError(result.error.message || "Pendaftaran gagal. Silakan coba lagi.");
            } else {
                // Show success popup instead of redirect
                setShowSuccess(true);
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    };

    // Success popup
    if (showSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black/20 p-4">
                <div className="max-w-md w-full bg-white dark:bg-surface-dark rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 text-center">
                    {/* Success Icon */}
                    <div className="flex justify-center mb-6">
                        <div className="relative">
                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-full">
                                <MailCheck className="w-16 h-16 text-green-600" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 p-1.5 bg-green-600 rounded-full">
                                <CheckCircle className="w-5 h-5 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white mb-3">
                        Pendaftaran Berhasil! 🎉
                    </h1>

                    {/* Message */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                        <p className="text-blue-800 dark:text-blue-300 font-medium mb-2">
                            Email verifikasi telah dikirim ke:
                        </p>
                        <p className="text-blue-600 dark:text-blue-400 font-bold text-lg">
                            {email}
                        </p>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        Silakan cek <strong>inbox email</strong> Anda dan klik tombol <strong>"Verifikasi Email"</strong> untuk mengaktifkan akun.
                        <br /><br />
                        <span className="text-sm text-slate-400">
                            Tidak menemukan email? Cek folder <strong>Spam</strong> atau <strong>Promosi</strong>.
                        </span>
                    </p>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Link
                            href="/auth/login"
                            className="block w-full py-3.5 bg-brand-primary hover:bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-brand-primary/25 transition-all text-center"
                        >
                            Lanjut ke Halaman Login
                        </Link>
                        <Link
                            href="/"
                            className="block w-full py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-center"
                        >
                            Kembali ke Beranda
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

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
                        Buat Akun Baru
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Bergabunglah dengan komunitas pecinta olahraga raket terbesar.
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleRegister} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-white">
                            Nama Lengkap
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <User className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Budi Santoso"
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            />
                        </div>
                    </div>

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
                                required
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-white">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                <Lock className="w-5 h-5" />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                className="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Minimal 8 karakter dengan kombinasi huruf dan angka.
                        </p>
                    </div>

                    <div className="flex items-start gap-2">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="mt-1 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                        />
                        <p className="text-sm text-slate-500">
                            Saya setuju dengan <Link href="#" className="text-brand-primary font-bold hover:underline">Syarat & Ketentuan</Link> serta <Link href="#" className="text-brand-primary font-bold hover:underline">Kebijakan Privasi</Link>.
                        </p>
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
                                Daftar Sekarang
                                <ArrowRight className="w-5 h-5" />
                            </>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <p className="mt-8 text-center text-sm text-slate-500">
                    Sudah punya akun?{" "}
                    <Link href="/auth/login" className="font-bold text-brand-primary hover:underline">
                        Masuk Disini
                    </Link>
                </p>
            </div>
        </div>
    );
}


