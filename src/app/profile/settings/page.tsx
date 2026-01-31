import { Save, User, Lock, Bell, Shield } from "lucide-react";
import Image from "next/image";

export default function ProfileSettingsPage() {
    return (
        <div className="flex-1">
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 dark:text-white mb-2 uppercase">
                    Pengaturan Akun
                </h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Kelola informasi pribadi, keamanan, dan preferensi notifikasi.
                </p>
            </div>

            <div className="space-y-8 max-w-3xl">
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
                                <div className="h-24 w-24 rounded-full overflow-hidden border-4 border-slate-100 dark:border-slate-800 relative group cursor-pointer">
                                    <Image
                                        src="https://lh3.googleusercontent.com/aida-public/AB6AXuCef0deJkCcubfo3cuAeO3KI-TuJJoMo35rb8_hlxiopb2pprzliSvN2FbWKjhXDfFte9MX8ZGQDIZJ2D4i2p3uWxhZDyBwwmh5esX5zwq9hgUCsRZvdJbtKwYFmOS1kGMQfHCvy5JmD0ljy2Dycj8mJmnmQ2thc9OTwC-p8XvHNpTC7C4XMgdOQbaAr3oIF_nlWnqO9eg0sqcvxOrEv2x93YhplxG6QVWaDJp48PJIKVWAKiQoaIqe-tDLFMdEwjxFY2pcSU03tV4"
                                        alt="Profile"
                                        fill
                                        className="object-cover"
                                    />
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
                                    defaultValue="Budi Santoso"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    defaultValue="budi@example.com"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Nomor Telepon
                                </label>
                                <input
                                    type="tel"
                                    defaultValue="+62 812 3456 7890"
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Tanggal Lahir
                                </label>
                                <input
                                    type="date"
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
                                    className="block w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary sm:text-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    Konfirmasi Password Baru
                                </label>
                                <input
                                    type="password"
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
                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-medium text-slate-900 dark:text-white">Promo & Diskon</h3>
                                <p className="text-xs text-slate-500">Dapatkan info promo terbaru dari JualBeliRaket.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                            </label>
                        </div>
                    </div>
                </section>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <button className="flex items-center gap-2 px-8 py-3 bg-brand-primary hover:bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-brand-primary/25 transition-all transform active:scale-[0.98]">
                        <Save className="w-5 h-5" />
                        Simpan Perubahan
                    </button>
                </div>
            </div>
        </div>
    );
}
