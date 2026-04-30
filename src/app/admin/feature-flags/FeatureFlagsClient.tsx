"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import { toggleFeatureFlag, updateFeatureFlag } from "@/actions/admin/feature-flags";

type FeatureFlagRow = {
    key: string;
    description: string;
    enabled: boolean;
    rollout_pct: number;
    audience: { roles?: string[]; userIds?: string[]; cohorts?: string[] };
    variants: Record<string, number> | null;
    parent_key: string | null;
    scheduled_enable_at: string | Date | null;
    scheduled_disable_at: string | Date | null;
    category: string;
    owner: string | null;
    notes: string | null;
};

type KillSwitchRow = {
    active: boolean;
    scope: string;
    reason: string | null;
    activated_at: string | Date | null;
} | null;

function toInputDateTime(value: string | Date | null): string {
    if (!value) return "";
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDate(value: string | Date | null): string {
    if (!value) return "-";
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function FeatureFlagsClient({
    initialFlags,
    killSwitch,
}: {
    initialFlags: FeatureFlagRow[];
    killSwitch: KillSwitchRow;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("all");
    const [reason, setReason] = useState<Record<string, string>>({});
    const [drafts, setDrafts] = useState<Record<string, {
        rolloutPct: string;
        owner: string;
        notes: string;
        parentKey: string;
        scheduledEnableAt: string;
        scheduledDisableAt: string;
        roles: string;
        userIds: string;
        cohorts: string;
        variants: string;
        confirmationPhrase: string;
    }>>(() => Object.fromEntries(initialFlags.map((flag) => [flag.key, {
        rolloutPct: String(flag.rollout_pct),
        owner: flag.owner ?? "",
        notes: flag.notes ?? "",
        parentKey: flag.parent_key ?? "",
        scheduledEnableAt: toInputDateTime(flag.scheduled_enable_at),
        scheduledDisableAt: toInputDateTime(flag.scheduled_disable_at),
        roles: (flag.audience?.roles ?? []).join(", "),
        userIds: (flag.audience?.userIds ?? []).join(", "),
        cohorts: (flag.audience?.cohorts ?? []).join(", "),
        variants: flag.variants
            ? Object.entries(flag.variants).map(([k, v]) => `${k}=${v}`).join(", ")
            : "",
        confirmationPhrase: "",
    }])));
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const categories = useMemo(() => ["all", ...new Set(initialFlags.map((flag) => flag.category))], [initialFlags]);
    const filteredFlags = useMemo(() => {
        return initialFlags.filter((flag) => {
            const matchesCategory = category === "all" || flag.category === category;
            const haystack = `${flag.key} ${flag.description} ${flag.owner ?? ""}`.toLowerCase();
            const matchesQuery = query.trim() === "" || haystack.includes(query.trim().toLowerCase());
            return matchesCategory && matchesQuery;
        });
    }, [category, initialFlags, query]);

    function setDraftValue(key: string, field: keyof typeof drafts[string], value: string) {
        setDrafts((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value,
            },
        }));
    }

    function requireReason(key: string): string | null {
        const value = (reason[key] ?? "").trim();
        if (value.length < 3) {
            setMessage({ type: "error", text: `Alasan untuk ${key} minimal 3 karakter.` });
            return null;
        }
        return value;
    }

    function handleToggle(key: string, nextEnabled: boolean) {
        const cleanReason = requireReason(key);
        if (!cleanReason) return;
        const flag = initialFlags.find((f) => f.key === key);
        const confirmationPhrase = drafts[key]?.confirmationPhrase ?? "";
        if (flag?.category === "trust" && confirmationPhrase.toUpperCase() !== "SAYA YAKIN") {
            setMessage({ type: "error", text: `Flag '${key}' kategori trust. Ketik SAYA YAKIN di field konfirmasi sebelum toggle.` });
            return;
        }
        setMessage(null);
        startTransition(async () => {
            try {
                await toggleFeatureFlag(key, nextEnabled, cleanReason, { confirmationPhrase });
                setMessage({ type: "success", text: `Flag ${key} berhasil diperbarui.` });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal toggle flag." });
            }
        });
    }

    function parseCsv(value: string): string[] {
        return value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }

    function parseVariants(value: string): Record<string, number> | null {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const out: Record<string, number> = {};
        for (const part of trimmed.split(",")) {
            const [k, v] = part.split("=").map((s) => s.trim());
            if (!k) continue;
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0 || n > 100) continue;
            out[k] = Math.round(n);
        }
        return Object.keys(out).length > 0 ? out : null;
    }

    function handleSave(key: string) {
        const cleanReason = requireReason(key);
        if (!cleanReason) return;
        const draft = drafts[key];
        setMessage(null);
        startTransition(async () => {
            try {
                await updateFeatureFlag({
                    key,
                    reason: cleanReason,
                    rolloutPct: Number(draft.rolloutPct || 0),
                    owner: draft.owner,
                    notes: draft.notes,
                    parentKey: draft.parentKey || null,
                    scheduledEnableAt: draft.scheduledEnableAt || null,
                    scheduledDisableAt: draft.scheduledDisableAt || null,
                    audience: {
                        roles: parseCsv(draft.roles),
                        userIds: parseCsv(draft.userIds),
                        cohorts: parseCsv(draft.cohorts),
                    },
                    variants: parseVariants(draft.variants),
                    confirmationPhrase: draft.confirmationPhrase || undefined,
                });
                setMessage({ type: "success", text: `Konfigurasi ${key} berhasil disimpan.` });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menyimpan flag." });
            }
        });
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase flex items-center gap-3">
                            <SlidersHorizontal className="w-7 h-7 text-brand-primary" />
                            Feature Flags
                        </h1>
                        <p className="text-slate-500 mt-1">Kelola rollout, toggle, dan emergency control semua fitur baru tanpa redeploy.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Link href="/admin/feature-flags/audit" className="px-4 py-2 rounded-lg border border-slate-200 hover:border-brand-primary hover:text-brand-primary transition-colors">
                            Audit Log
                        </Link>
                        <Link href="/admin/feature-flags/kill-switch" className="px-4 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors">
                            Kill Switch
                        </Link>
                    </div>
                </div>

                <div className={`rounded-xl border px-4 py-3 text-sm ${killSwitch?.active ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                    <div className="flex items-center gap-2 font-semibold">
                        {killSwitch?.active ? <ShieldAlert className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        {killSwitch?.active ? `Kill-switch aktif (${killSwitch.scope})` : "Kill-switch nonaktif"}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                        Alasan: {killSwitch?.reason || "-"} · Diperbarui: {formatDate(killSwitch?.activated_at ?? null)}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-3">
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Cari key, deskripsi, atau owner"
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 bg-slate-50"
                    />
                    <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className="rounded-xl border border-slate-200 px-4 py-2.5 bg-slate-50"
                    >
                        {categories.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                {message && (
                    <div className={`rounded-xl border px-4 py-3 text-sm ${message.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}>
                        {message.text}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                {filteredFlags.map((flag) => (
                    <div key={flag.key} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="font-semibold text-slate-900">{flag.key}</h2>
                                    <span className={`text-[11px] font-bold uppercase px-2 py-1 rounded-full ${flag.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                                        {flag.enabled ? "enabled" : "disabled"}
                                    </span>
                                    <span className="text-[11px] font-bold uppercase px-2 py-1 rounded-full bg-brand-primary/10 text-brand-primary">
                                        {flag.category}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600">{flag.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    href={`/admin/feature-flags/${encodeURIComponent(flag.key)}/impact`}
                                    className="px-3 py-2 rounded-xl border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-sm transition-colors"
                                >
                                    Impact
                                </Link>
                                <button
                                    type="button"
                                    disabled={isPending}
                                    onClick={() => handleToggle(flag.key, !flag.enabled)}
                                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${flag.enabled ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-brand-primary text-white hover:bg-brand-primary/90"}`}
                                >
                                    {isPending ? <RefreshCw className="w-4 h-4 animate-spin inline" /> : flag.enabled ? "Disable" : "Enable"}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Rollout %</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={100}
                                    value={drafts[flag.key]?.rolloutPct ?? "0"}
                                    onChange={(event) => setDraftValue(flag.key, "rolloutPct", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Owner</span>
                                <input
                                    type="text"
                                    value={drafts[flag.key]?.owner ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "owner", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Parent Flag</span>
                                <select
                                    value={drafts[flag.key]?.parentKey ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "parentKey", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                >
                                    <option value="">Tanpa parent</option>
                                    {initialFlags.filter((candidate) => candidate.key !== flag.key).map((candidate) => (
                                        <option key={candidate.key} value={candidate.key}>
                                            {candidate.key}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Scheduled Enable</span>
                                <input
                                    type="datetime-local"
                                    value={drafts[flag.key]?.scheduledEnableAt ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "scheduledEnableAt", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Scheduled Disable</span>
                                <input
                                    type="datetime-local"
                                    value={drafts[flag.key]?.scheduledDisableAt ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "scheduledDisableAt", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Audience: roles (CSV)</span>
                                <input
                                    type="text"
                                    placeholder="ADMIN, STAFF, BETA"
                                    value={drafts[flag.key]?.roles ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "roles", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                />
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Audience: userIds (CSV)</span>
                                <input
                                    type="text"
                                    placeholder="usr_..."
                                    value={drafts[flag.key]?.userIds ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "userIds", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                />
                            </label>
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Audience: cohorts (CSV)</span>
                                <input
                                    type="text"
                                    placeholder="beta-pdp, internal"
                                    value={drafts[flag.key]?.cohorts ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "cohorts", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                />
                            </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <label className="text-sm space-y-1">
                                <span className="font-medium text-slate-700">Variants A/B/C (FORMAT: name=weight, total ≤ 100)</span>
                                <input
                                    type="text"
                                    placeholder="control=50, variant_a=50"
                                    value={drafts[flag.key]?.variants ?? ""}
                                    onChange={(event) => setDraftValue(flag.key, "variants", event.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                />
                            </label>
                            {flag.category === "trust" && (
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-rose-700">Konfirmasi trust (ketik: SAYA YAKIN)</span>
                                    <input
                                        type="text"
                                        placeholder="SAYA YAKIN"
                                        value={drafts[flag.key]?.confirmationPhrase ?? ""}
                                        onChange={(event) => setDraftValue(flag.key, "confirmationPhrase", event.target.value)}
                                        className="w-full rounded-lg border border-rose-300 px-3 py-2 bg-rose-50 font-mono text-xs"
                                    />
                                </label>
                            )}
                        </div>

                        <label className="block text-sm space-y-1">
                            <span className="font-medium text-slate-700">Notes</span>
                            <textarea
                                rows={3}
                                value={drafts[flag.key]?.notes ?? ""}
                                onChange={(event) => setDraftValue(flag.key, "notes", event.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 resize-none"
                            />
                        </label>

                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-start">
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Reason (required for audit log)</span>
                                <input
                                    type="text"
                                    value={reason[flag.key] ?? ""}
                                    onChange={(event) => setReason((prev) => ({ ...prev, [flag.key]: event.target.value }))}
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={() => handleSave(flag.key)}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                            >
                                {isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Simpan
                            </button>
                        </div>
                    </div>
                ))}

                {filteredFlags.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                        Tidak ada feature flag yang cocok dengan filter saat ini.
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 mt-0.5" />
                <div>
                    Perubahan flag bersifat operasional. Gunakan alasan yang jelas dan lakukan audit lewat halaman audit log sebelum dan sesudah rollout besar.
                </div>
            </div>
        </div>
    );
}