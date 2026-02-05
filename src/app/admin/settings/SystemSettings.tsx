"use client";

import { useState, useTransition } from "react";
import { Globe, Save, AlertTriangle, RefreshCw, Check } from "lucide-react";
import { updateEnvSettings } from "@/actions/env-settings";

interface SystemSettingsProps {
    initialSettings: {
        NEXT_PUBLIC_APP_URL: string;
        BETTER_AUTH_URL: string;
        EMAIL_FROM: string;
        SMTP_HOST: string;
        SMTP_PORT: string;
    };
}

export function SystemSettings({ initialSettings }: SystemSettingsProps) {
    const [settings, setSettings] = useState(initialSettings);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleChange = (key: keyof typeof settings, value: string) => {
        setSettings((prev) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setMessage(null);
        startTransition(async () => {
            const result = await updateEnvSettings(settings);
            setMessage({
                type: result.success ? "success" : "error",
                text: result.message,
            });
        });
    };

    const fields = [
        {
            key: "NEXT_PUBLIC_APP_URL" as const,
            label: "Site URL / Domain",
            placeholder: "https://jualbeliraket.com",
            description: "URL utama website (digunakan untuk email dan link)",
        },
        {
            key: "BETTER_AUTH_URL" as const,
            label: "Auth Origin URL",
            placeholder: "https://jualbeliraket.com",
            description: "URL untuk autentikasi (biasanya sama dengan Site URL)",
        },
        {
            key: "EMAIL_FROM" as const,
            label: "Email Pengirim",
            placeholder: "noreply@jualbeliraket.com",
            description: "Alamat email pengirim untuk notifikasi sistem",
        },
        {
            key: "SMTP_HOST" as const,
            label: "SMTP Host",
            placeholder: "localhost",
            description: "Server SMTP untuk pengiriman email",
        },
        {
            key: "SMTP_PORT" as const,
            label: "SMTP Port",
            placeholder: "25",
            description: "Port server SMTP",
        },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                    <Globe className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Pengaturan Sistem
                </h2>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                    <p className="font-medium">Perhatian</p>
                    <p>Perubahan akan disimpan ke file <code className="bg-amber-200/50 dark:bg-amber-800/50 px-1 rounded">.env.local</code>.
                        Anda perlu <strong>restart aplikasi</strong> (PM2) agar perubahan berlaku.</p>
                </div>
            </div>

            {/* Settings Form */}
            <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
                {fields.map((field) => (
                    <div key={field.key}>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {field.label}
                        </label>
                        <input
                            type="text"
                            value={settings[field.key]}
                            onChange={(e) => handleChange(field.key, e.target.value)}
                            placeholder={field.placeholder}
                            className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {field.description}
                        </p>
                    </div>
                ))}

                {/* Message */}
                {message && (
                    <div className={`rounded-lg p-3 flex items-center gap-2 ${message.type === "success"
                            ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                        }`}>
                        {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        <span className="text-sm">{message.text}</span>
                    </div>
                )}

                {/* Save Button */}
                <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Menyimpan...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            Simpan Pengaturan
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
