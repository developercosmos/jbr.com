import { Save, Upload, MapPin, Store } from "lucide-react";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function SellerSettingsPage() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    const user = session.user;

    return (
        <div className="flex-1 p-8 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                        Pengaturan Toko
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Kelola informasi toko, branding, dan alamat pengiriman.
                    </p>
                </div>

                {/* Store Profile Section */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Store className="w-5 h-5 text-brand-primary" />
                            Profil Toko
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        {/* Banner & Logo */}
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                Branding Toko
                            </label>
                            <div className="relative h-48 rounded-xl bg-slate-100 dark:bg-black/20 border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group overflow-hidden">
                                <div className="relative z-10 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Upload className="w-8 h-8" />
                                    <span className="text-sm font-medium">Klik untuk upload banner</span>
                                </div>
                                {/* Logo Overlay */}
                                <div className="absolute -bottom-6 left-6">
                                    <div className="h-24 w-24 rounded-full border-4 border-white dark:border-surface-dark bg-brand-primary/10 overflow-hidden relative group/logo cursor-pointer flex items-center justify-center">
                                        {user.image ? (
                                            <Image
                                                src={user.image}
                                                alt="Store Logo"
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <span className="text-2xl font-bold text-brand-primary">
                                                {(user.name || "").slice(0, 2).toUpperCase() || "??"}
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                                            <Upload className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nama Toko
                                </label>
                                <input
                                    type="text"
                                    defaultValue={user.name || ""}
                                    placeholder="Masukkan nama toko"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Slogan / Tagline
                                </label>
                                <input
                                    type="text"
                                    placeholder="Contoh: Best Gear for Best Player"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Deskripsi Toko
                                </label>
                                <textarea
                                    rows={4}
                                    placeholder="Jelaskan tentang toko Anda..."
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Address Section */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-5 h-5 text-brand-primary" />
                            Alamat & Pengiriman
                        </h2>
                    </div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Alamat Lengkap
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Jl. Olahraga No. 123, Komplek Stadion Utama"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Kota / Kabupaten
                                </label>
                                <select className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm">
                                    <option value="">Pilih kota</option>
                                    <option>Jakarta Selatan</option>
                                    <option>Bandung</option>
                                    <option>Surabaya</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Kode Pos
                                </label>
                                <input
                                    type="text"
                                    placeholder="12345"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button className="flex items-center gap-2 px-6 py-3 bg-brand-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all transform active:scale-[0.98]">
                        <Save className="w-5 h-5" />
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    );
}
