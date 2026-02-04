"use client";

import Link from "next/link";
import { useState } from "react";
import { Mail, ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { requestPasswordReset } from "@/actions/auth-email";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await requestPasswordReset(email);
            if (result.success) {
                setIsSuccess(true);
            } else {
                setError(result.error || "Terjadi kesalahan");
            }
        } catch {
            setError("Terjadi kesalahan. Silakan coba lagi.");
        } finally {
            setIsLoading(false);
        }
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
                <div className="w-full max-w-md">
                    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-3">
                            Cek Email Anda
                        </h1>
                        <p className="text-slate-600 mb-6">
                            Jika email terdaftar, kami telah mengirimkan link untuk reset password ke <strong>{email}</strong>
                        </p>
                        <p className="text-sm text-slate-500 mb-6">
                            Link akan kedaluwarsa dalam 1 jam. Cek juga folder spam jika tidak menemukan email.
                        </p>
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-2 text-brand-primary hover:underline font-medium"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Kembali ke Login
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-brand-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Mail className="w-8 h-8 text-brand-primary" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            Lupa Password?
                        </h1>
                        <p className="text-slate-600">
                            Masukkan email Anda dan kami akan mengirimkan link untuk reset password.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@example.com"
                                required
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-brand-primary text-white font-semibold rounded-xl hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Mengirim...
                                </>
                            ) : (
                                "Kirim Link Reset"
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <Link
                            href="/auth/login"
                            className="inline-flex items-center gap-2 text-slate-600 hover:text-brand-primary transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Kembali ke Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
