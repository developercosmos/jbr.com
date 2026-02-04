"use client";

import { Save, User, Lock, Bell } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";

interface UserData {
    id: string;
    name: string;
    email: string;
    image?: string | null;
}

export function SettingsForm({ user }: { user: UserData }) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [formData, setFormData] = useState({
        name: user.name || "",
        email: user.email || "",
        phone: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        emailTransactions: true,
        emailPromo: false,
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        // Validate passwords if changing
        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: "error", text: "Password baru tidak cocok" });
            return;
        }

        startTransition(async () => {
            try {
                // TODO: Implement updateProfile action
                setMessage({ type: "success", text: "Pengaturan berhasil disimpan" });
            } catch (err) {
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal menyimpan" });
            }
        });
    };

    return (
        <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
            {message && (
                <div className={`p-4 rounded-lg ${message.type === "success"
                        ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400"
                        : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Personal Info */}
            <section className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-brand-primary" />
                        Informasi Pribadi
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-6">
                        <div className="relative h-24 w-24 flex-shrink-0">
                            <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 relative group cursor-pointer bg-brand-primary/10">
                                {user.image ? (
                                    <Image
                                        src={user.image}
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-2xl font-bold text-brand-primary">
                                            {user.name?.slice(0, 2).toUpperCase() || "??"}
                                        </span>
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-white font-bold">Ubah</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-900 dark:text-white">Foto Profil</h3>
                            <p className="text-sm text-slate-500">
                                Format: JPG, GIF atau PNG. Ukuran maks. 1MB.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Nama Lengkap
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Nomor Telepon
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="08xx-xxxx-xxxx"
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Security */}
            <section className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Lock className="w-5 h-5 text-brand-primary" />
                        Keamanan
                    </h2>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Password Saat Ini
                        </label>
                        <input
                            type="password"
                            value={formData.currentPassword}
                            onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Password Baru
                            </label>
                            <input
                                type="password"
                                value={formData.newPassword}
                                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Konfirmasi Password Baru
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Notifications */}
            <section className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-brand-primary" />
                        Notifikasi
                    </h2>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Email Transaksi</h3>
                            <p className="text-xs text-slate-500">Terima email tentang status pesanan Anda.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.emailTransactions}
                                onChange={(e) => setFormData({ ...formData, emailTransactions: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-medium text-slate-900 dark:text-white">Promo & Diskon</h3>
                            <p className="text-xs text-slate-500">Dapatkan info promo terbaru dari JualBeliRaket.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.emailPromo}
                                onChange={(e) => setFormData({ ...formData, emailPromo: e.target.checked })}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                        </label>
                    </div>
                </div>
            </section>

            {/* Save Button */}
            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={isPending}
                    className="flex items-center gap-2 px-8 py-3 bg-brand-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all transform active:scale-[0.98] disabled:opacity-50"
                >
                    <Save className="w-5 h-5" />
                    {isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
            </div>
        </form>
    );
}
