"use client";

import { useState, useTransition } from "react";
import { Power, ChevronDown, ChevronUp, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { toggleIntegration, updateIntegration } from "@/actions/settings";
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
                await updateIntegration(integration.key, {
                    credentials,
                    config,
                });
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
                    {integration.credentials && Object.keys(integration.credentials).length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Credentials
                            </h4>
                            <div className="grid gap-4">
                                {Object.entries(integration.credentials).map(([key, value]) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                            {credentialLabels[integration.key]?.[key] || key}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showSecrets[key] ? "text" : "password"}
                                                value={credentials[key] || ""}
                                                onChange={(e) => setCredentials({ ...credentials, [key]: e.target.value })}
                                                placeholder={value || "Masukkan nilai..."}
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
                    {integration.config && Object.keys(integration.config).length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                                Configuration
                            </h4>
                            <div className="grid gap-4">
                                {Object.entries(integration.config).map(([key, value]) => (
                                    <div key={key} className="space-y-1.5">
                                        <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                            {configLabels[integration.key]?.[key] || key}
                                        </label>
                                        <input
                                            type="text"
                                            value={config[key] || ""}
                                            onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
                                            placeholder={String(value) || "Masukkan nilai..."}
                                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-primary text-sm"
                                        />
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
