"use client";

import { useState, useTransition } from "react";
import { Power, ChevronDown, ChevronUp, Loader2, Save, Eye, EyeOff, RefreshCw, Truck } from "lucide-react";
import { toggleIntegration, updateIntegration, getBiteshipCourierOptions } from "@/actions/settings";
import type { BiteshipCourierOption } from "@/lib/biteship";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
    integration: {
        id: string;
        key: string;
        name: string;
        description: string | null;
        category: string;
        enabled: boolean;
        credentials: Record<string, string> | null;
        config: Record<string, unknown> | null;
    };
}

const credentialLabels: Record<string, Record<string, string>> = {
    xendit: {
        api_key: "Secret API Key",
        webhook_token: "Webhook Verification Token",
    },
    resend: {
        api_key: "API Key",
    },
    rajaongkir: {
        api_key: "API Key",
    },
    biteship: {
        api_key: "Biteship API Key",
        webhook_token: "Webhook Token",
    },
};

const configLabels: Record<string, Record<string, string>> = {
    xendit: {
        success_redirect_url: "Success Redirect URL",
        failure_redirect_url: "Failure Redirect URL",
    },
    resend: {
        from_email: "From Email",
        from_name: "From Name",
    },
    rajaongkir: {
        account_type: "Account Type",
    },
    biteship: {
        // Origin sebenarnya = alamat pickup MASING-MASING seller. Field di bawah
        // hanya FALLBACK saat seorang seller belum menyetel alamat pickup-nya.
        origin_postal_code: "Kode Pos Asal — fallback (jika seller belum set pickup)",
        origin_latitude: "Latitude Asal — fallback",
        origin_longitude: "Longitude Asal — fallback",
        origin_contact_name: "Nama Kontak Pengirim — fallback",
        origin_contact_phone: "Telepon Pengirim — fallback",
        origin_address: "Alamat Lengkap Asal — fallback",
        couriers: "Kurir yang ditawarkan di checkout",
        fallback_cost: "Ongkir Fallback (Rp) — jika rute live gagal",
    },
};

export function IntegrationCard({ integration }: IntegrationCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
    const [credentials, setCredentials] = useState<Record<string, string>>(
        integration.credentials || {}
    );
    const [config, setConfig] = useState<Record<string, string>>(
        (integration.config as Record<string, string>) || {}
    );
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Render the EXPECTED fields (from the label maps) even when not yet stored,
    // so an admin can configure a freshly-enabled integration (e.g. Biteship key +
    // origin) that has empty credentials/config.
    const credKeys = Array.from(new Set([
        ...Object.keys(credentialLabels[integration.key] ?? {}),
        ...Object.keys(integration.credentials ?? {}),
    ]));
    const configKeys = Array.from(new Set([
        ...Object.keys(configLabels[integration.key] ?? {}),
        ...Object.keys((integration.config as Record<string, unknown>) ?? {}),
    ]));

    const handleToggle = () => {
        startTransition(async () => {
            try {
                await toggleIntegration(integration.key, !integration.enabled);
            } catch (err) {
                console.error("Toggle error:", err);
            }
        });
    };

    const handleSave = () => {
        setMessage(null);
        startSaving(async () => {
            try {
                const res = await updateIntegration(integration.key, {
                    credentials,
                    config,
                });
                if (res && "success" in res && res.success === false) {
                    setMessage({ type: "error", text: res.error || "Gagal memperbarui integrasi." });
                    return;
                }
                setMessage({ type: "success", text: "Pengaturan berhasil disimpan" });
            } catch (err) {
                setMessage({ type: "error", text: err instanceof Error ? err.message : "Gagal menyimpan" });
            }
        });
    };

    return (
        <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleToggle}
                        disabled={isPending}
                        className={cn(
                            "relative w-14 h-7 rounded-full transition-colors",
                            integration.enabled ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600"
                        )}
                    >
                        <span
                            className={cn(
                                "absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform flex items-center justify-center",
                                integration.enabled && "translate-x-7"
                            )}
                        >
                            {isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                            ) : (
                                <Power className={cn("w-3 h-3", integration.enabled ? "text-green-500" : "text-slate-400")} />
                            )}
                        </span>
                    </button>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">{integration.name}</h3>
                        <p className="text-sm text-slate-500">{integration.description}</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-800 p-4 space-y-6">
                    {/* Credentials */}
                    {credKeys.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Credentials
                            </h4>
                            <div className="grid gap-4">
                                {credKeys.map((key) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                            {credentialLabels[integration.key]?.[key] || key}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecrets[key] ? "text" : "password"}
                                                value={credentials[key] || ""}
                                                onChange={(e) => setCredentials({ ...credentials, [key]: e.target.value })}
                                                placeholder={integration.credentials?.[key] || "Masukkan nilai..."}
                                                className="w-full px-3 py-2 pr-10 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-mono"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowSecrets({ ...showSecrets, [key]: !showSecrets[key] })}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                                            >
                                                {showSecrets[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Config */}
                    {configKeys.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Configuration
                            </h4>
                            <div className="grid gap-4">
                                {configKeys.map((key) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                            {configLabels[integration.key]?.[key] || key}
                                        </label>
                                        {integration.key === "biteship" && key === "couriers" ? (
                                            <BiteshipCourierChecklist
                                                value={config[key] || ""}
                                                onChange={(v) => setConfig({ ...config, couriers: v })}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={config[key] || ""}
                                                onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                                                placeholder={String((integration.config as Record<string, unknown>)?.[key] ?? "") || "Masukkan nilai..."}
                                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Message */}
                    {message && (
                        <div
                            className={cn(
                                "p-3 rounded-lg text-sm",
                                message.type === "success"
                                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                                    : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                            )}
                        >
                            {message.text}
                        </div>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 disabled:bg-slate-400 text-white font-bold rounded-lg transition-colors"
                        >
                            {isSaving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Simpan
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function parseCourierCodes(value: string): string[] {
    return value
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * Checklist sumber-kebenaran = string koma di config.couriers. Tombol "Muat dari
 * Biteship" memanggil GET /v1/couriers (admin-only, tanpa konsumsi saldo) lalu
 * menampilkan centang. Kode yang sudah tersimpan tapi tak ada di daftar Biteship
 * tetap ditampilkan agar tidak hilang. Selalu ada fallback input manual.
 */
function BiteshipCourierChecklist({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const [options, setOptions] = useState<BiteshipCourierOption[] | null>(null);
    const [isLoading, startLoading] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [manual, setManual] = useState(false);

    const selected = parseCourierCodes(value);
    const selectedSet = new Set(selected);

    const load = () => {
        setError(null);
        startLoading(async () => {
            const res = await getBiteshipCourierOptions();
            if (res.success) {
                setOptions(res.couriers);
                // Seed an empty selection from the account's currently-saved codes.
                if (parseCourierCodes(value).length === 0 && res.selected.length > 0) {
                    onChange(res.selected.join(","));
                }
            } else {
                setError(res.error);
            }
        });
    };

    const toggle = (code: string) => {
        const next = new Set(selectedSet);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        onChange(Array.from(next).join(","));
    };

    // Codes saved but not present in the fetched list (custom/legacy) — keep them.
    const extraSelected = selected.filter((c) => !(options ?? []).some((o) => o.code === c));

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={load}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-60"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {options ? "Muat ulang" : "Muat daftar kurir dari Biteship"}
                </button>
                <button
                    type="button"
                    onClick={() => setManual((m) => !m)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                >
                    {manual ? "Sembunyikan input manual" : "Input manual"}
                </button>
            </div>

            {error && (
                <div className="p-2.5 rounded-lg text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                </div>
            )}

            {options && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {options.map((c) => (
                        <label
                            key={c.code}
                            className={cn(
                                "flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                                selectedSet.has(c.code)
                                    ? "border-brand-primary bg-brand-primary/5"
                                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-white/5"
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={selectedSet.has(c.code)}
                                onChange={() => toggle(c.code)}
                                className="w-4 h-4 rounded accent-brand-primary"
                            />
                            <Truck className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="text-sm text-slate-800 dark:text-slate-100 flex-1">{c.name}</span>
                            {c.cod && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    COD
                                </span>
                            )}
                            <span className="text-[10px] text-slate-400">{c.services} layanan</span>
                        </label>
                    ))}
                </div>
            )}

            {/* Saved-but-not-in-list codes (don't silently drop) */}
            {extraSelected.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-400">Tersimpan (di luar daftar):</span>
                    {extraSelected.map((code) => (
                        <button
                            key={code}
                            type="button"
                            onClick={() => toggle(code)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-red-100 hover:text-red-600"
                            title="Klik untuk hapus"
                        >
                            {code} ✕
                        </button>
                    ))}
                </div>
            )}

            {!options && !error && (
                <p className="text-xs text-slate-400">
                    {selected.length > 0
                        ? `Terpilih saat ini: ${selected.join(", ")}`
                        : "Belum ada kurir dipilih. Muat daftar dari Biteship untuk mencentang."}
                </p>
            )}

            {manual && (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="jne,jnt,sicepat,anteraja"
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm font-mono"
                />
            )}
        </div>
    );
}
