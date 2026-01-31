import { Save, Upload, MapPin, Store } from "lucide-react";
import Image from "next/image";

export default function SellerSettingsPage() {
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
                                <div className="absolute inset-0 bg-cover bg-center opacity-50 group-hover:opacity-40 transition-opacity" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBCqzW94LamUg0EVwj6vOdTtlWWGHYCBgF4Df7V5vZA8VIIwW3fU6S0qk_Hoq3InI7gNnkp4o1lWUzXxDbx8WjBaxaNkmS5mUBgXiXwA0eHoKh7W3xoDiiA-4CiSRf9HU2PoQsIwaULrc0U9TzrPqi9_mJ1_UGKSxgfJ_ZzwrLV2hlG-KKW5KM_j43klFZmnCtA3FKJA8eW5-KYvm2dUG163tuNoegO2C_IauPlQxWLDhyEIAJYyyBAk-gSO5hlwLsomNl9vHmI9X4')" }}></div>
                                <div className="relative z-10 flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
                                    <Upload className="w-8 h-8" />
                                    <span className="text-sm font-medium">Klik untuk ganti banner</span>
                                </div>
                                {/* Logo Overlay */}
                                <div className="absolute -bottom-6 left-6">
                                    <div className="h-24 w-24 rounded-full border-4 border-white dark:border-surface-dark bg-white dark:bg-surface-dark overflow-hidden relative group/logo cursor-pointer">
                                        <Image
                                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBCqzW94LamUg0EVwj6vOdTtlWWGHYCBgF4Df7V5vZA8VIIwW3fU6S0qk_Hoq3InI7gNnkp4o1lWUzXxDbx8WjBaxaNkmS5mUBgXiXwA0eHoKh7W3xoDiiA-4CiSRf9HU2PoQsIwaULrc0U9TzrPqi9_mJ1_UGKSxgfJ_ZzwrLV2hlG-KKW5KM_j43klFZmnCtA3FKJA8eW5-KYvm2dUG163tuNoegO2C_IauPlQxWLDhyEIAJYyyBAk-gSO5hlwLsomNl9vHmI9X4"
                                            alt="Store Logo"
                                            fill
                                            className="object-cover"
                                        />
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
                                    defaultValue="Agus Sport Store"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Slogan / Tagline
                                </label>
                                <input
                                    type="text"
                                    defaultValue="Best Gear for Best Player"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Deskripsi Toko
                                </label>
                                <textarea
                                    rows={4}
                                    defaultValue="Menjual berbagai macam perlengkapan olahraga original dan berkualitas. Melayani pengiriman ke seluruh Indonesia."
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
                                    defaultValue="Jl. Olahraga No. 123, Komplek Stadion Utama"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm resize-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Kota / Kabupaten
                                </label>
                                <select className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm">
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
                                    defaultValue="12345"
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
