"use client";

import { Save, User, Lock, Bell, Upload, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { updateProfile } from "@/actions/profile";

interface UserData {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    phone?: string | null;
    locale?: string | null;
}

interface FormState {
    name: string;
    email: string;
    phone: string;
    avatarUrl: string;
    locale: "id-ID" | "en-US";
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    emailTransactions: boolean;
    emailPromo: boolean;
}

export function SettingsForm({ user }: { user: UserData }) {
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const [isPending, startTransition] = useTransition();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
    const [savedProfile, setSavedProfile] = useState({
        name: user.name || "",
        phone: user.phone || "",
        avatarUrl: user.image || "",
        locale: (user.locale as "id-ID" | "en-US") || "id-ID",
    });
    const [formData, setFormData] = useState<FormState>({
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatarUrl: user.image || "",
        locale: (user.locale as "id-ID" | "en-US") || "id-ID",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        emailTransactions: true,
        emailPromo: false,
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setFieldErrors({});

        if (formData.newPassword && formData.newPassword !== formData.confirmPassword) {
            setMessage({ type: "error", text: "Password baru tidak cocok" });
            return;
        }

        if (formData.newPassword && !formData.currentPassword) {
            setMessage({ type: "error", text: "Masukkan password saat ini untuk mengganti password" });
            return;
        }

        if (!formData.newPassword && formData.currentPassword) {
            setMessage({ type: "error", text: "Isi password baru jika ingin mengganti password" });
            return;
        }

        startTransition(async () => {
            try {
                const result = await updateProfile({
                    name: formData.name,
                    phone: formData.phone,
                    avatarUrl: formData.avatarUrl,
                    locale: formData.locale,
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                });

                if (!result.success) {
                    setFieldErrors(result.fieldErrors);
                    setFormData((current) => ({
                        ...current,
                        name: savedProfile.name,
                        phone: savedProfile.phone,
                        avatarUrl: savedProfile.avatarUrl,
                        locale: savedProfile.locale,
                    }));
                    setMessage({ type: "error", text: "Periksa kembali data profil Anda." });
                    return;
                }

                const nextSavedProfile = {
                    name: result.user.name || "",
                    phone: result.user.phone || "",
                    avatarUrl: result.user.image || "",
                    locale: (result.user.locale as "id-ID" | "en-US") || "id-ID",
                };

                setSavedProfile(nextSavedProfile);
                setFormData((current) => ({
                    ...current,
                    name: nextSavedProfile.name,
                    phone: nextSavedProfile.phone,
                    avatarUrl: nextSavedProfile.avatarUrl,
                    locale: nextSavedProfile.locale,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                }));
                setMessage({
                    type: "success",
                    text: result.passwordChanged
                        ? "Perubahan berhasil disimpan. Password Anda juga berhasil diperbarui."
                        : "Profil berhasil diperbarui",
                });
            } catch (err) {
                setFormData((current) => ({
                    ...current,
                    name: savedProfile.name,
                    phone: savedProfile.phone,
                    avatarUrl: savedProfile.avatarUrl,
                    locale: savedProfile.locale,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                }));
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal menyimpan" });
            }
        });
    };

    const renderFieldError = (field: string) => {
        const error = fieldErrors[field]?.[0];
        if (!error) {
            return null;
        }

        return <p className="text-sm text-red-600">{error}</p>;
    };

    const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "File avatar harus berupa gambar." });
            event.target.value = "";
            return;
        }

        setMessage(null);
        setIsUploadingAvatar(true);

        try {
            const body = new FormData();
            body.append("file", file);
            body.append("folder", "avatars");

            const response = await fetch("/api/upload", {
                method: "POST",
                body,
            });

            const payload = await response.json();
            if (!response.ok || !payload?.success || !payload?.url) {
                throw new Error(payload?.error || "Upload avatar gagal.");
            }

            setFormData((current) => ({
                ...current,
                avatarUrl: payload.url,
            }));
            setMessage({ type: "success", text: "Foto profil berhasil diupload. Klik Simpan Perubahan untuk menerapkan." });
        } catch (error) {
            setMessage({ type: "error", text: error instanceof Error ? error.message : "Upload avatar gagal." });
        } finally {
            setIsUploadingAvatar(false);
            event.target.value = "";
        }
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
                                {formData.avatarUrl ? (
                                    <Image
                                        src={formData.avatarUrl}
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-2xl font-bold text-brand-primary">
                                            {formData.name?.slice(0, 2).toUpperCase() || "??"}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1 flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white">Foto Profil</h3>
                            <p className="text-sm text-slate-500">
                                Upload foto profil Anda (disimpan pada storage S3 jika konfigurasi aktif).
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <input
                                    ref={avatarInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                                    onChange={handleAvatarUpload}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => avatarInputRef.current?.click()}
                                    disabled={isUploadingAvatar || isPending}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold disabled:opacity-60"
                                >
                                    {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                    {isUploadingAvatar ? "Mengupload..." : "Upload Foto"}
                                </button>
                            </div>
                            <input
                                type="url"
                                value={formData.avatarUrl}
                                onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                                readOnly
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                placeholder="URL avatar akan terisi otomatis setelah upload"
                            />
                            {renderFieldError("avatarUrl")}
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
                            {renderFieldError("name")}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Email
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                readOnly
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-black/30 text-slate-500 dark:text-slate-300 focus:outline-none sm:text-sm"
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
                            {renderFieldError("phone")}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Bahasa / Locale
                            </label>
                            <select
                                value={formData.locale}
                                onChange={(e) => setFormData({ ...formData, locale: e.target.value as "id-ID" | "en-US" })}
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            >
                                <option value="id-ID">Bahasa Indonesia</option>
                                <option value="en-US">English (US)</option>
                            </select>
                            {renderFieldError("locale")}
                        </div>
                    </div>
                </div>
            </section>

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
                            name="current-password-input"
                            autoComplete="off"
                            placeholder="Masukkan password lama"
                            className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                        />
                        {renderFieldError("currentPassword")}
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
                                autoComplete="new-password"
                                placeholder="Minimal 6 karakter"
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                            {renderFieldError("newPassword")}
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                Konfirmasi Password Baru
                            </label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                autoComplete="new-password"
                                placeholder="Ulangi password baru"
                                className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                            />
                        </div>
                    </div>
                </div>
            </section>

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
