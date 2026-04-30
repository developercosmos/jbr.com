"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldAlert, SlidersHorizontal, Search } from "lucide-react";
import { toggleFeatureFlag, updateFeatureFlag } from "@/actions/admin/feature-flags";
import { FEATURE_FLAG_META } from "@/lib/feature-flag-metadata";
import { HelpDrawer } from "./HelpDrawer";
import { FeatureFlagCard, type FlagRow } from "./FeatureFlagCard";

type KillSwitchRow = {
    active: boolean;
    scope: string;
    reason: string | null;
    activated_at: string | Date | null;
} | null;

type DraftValue = {
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
    reason: string;
};

const CATEGORY_META: Record<string, { label: string; icon: string; description: string }> = {
    pdp: {
        label: "Halaman Produk",
        icon: "📦",
        description: "Fitur yang muncul di halaman detail produk: tawar inline, badge seller, thumbnail review.",
    },
    trust: {
        label: "Trust & Safety",
        icon: "🛡️",
        description: "Fitur yang menyangkut rating buyer, dispute, dan privacy data — wajib konfirmasi tambahan.",
    },
    differentiator: {
        label: "Fitur Unggulan",
        icon: "⭐",
        description: "Fitur kompetitif yang membedakan JBR: live presence, auto-counter, audit replay, smart questions, dll.",
    },
};

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

function buildDraft(flag: FlagRow): DraftValue {
    return {
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
        reason: "",
    };
}

function parseCsv(value: string): string[] {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
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

export function FeatureFlagsClient({
    initialFlags,
    killSwitch,
}: {
    initialFlags: FlagRow[];
    killSwitch: KillSwitchRow;
}) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [drafts, setDrafts] = useState<Record<string, DraftValue>>(
        () => Object.fromEntries(initialFlags.map((f) => [f.key, buildDraft(f)]))
    );
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [isPending, startTransition] = useTransition();

    const allFlagKeys = useMemo(() => initialFlags.map((f) => f.key), [initialFlags]);

    const filtered = useMemo(() => {
        return initialFlags.filter((flag) => {
            if (category !== "all" && flag.category !== category) return false;
            if (statusFilter === "enabled" && !flag.enabled) return false;
            if (statusFilter === "disabled" && flag.enabled) return false;
            if (statusFilter === "trust" && flag.category !== "trust") return false;

            const q = query.trim().toLowerCase();
            if (!q) return true;
            const meta = FEATURE_FLAG_META[flag.key];
            const haystack = [
                flag.key,
                flag.description,
                flag.owner ?? "",
                meta?.friendlyName ?? "",
                meta?.description ?? "",
                meta?.ticket ?? "",
            ].join(" ").toLowerCase();
            return haystack.includes(q);
        });
    }, [initialFlags, category, statusFilter, query]);

    const grouped = useMemo(() => {
        const groups: Record<string, FlagRow[]> = {};
        for (const flag of filtered) {
            const cat = flag.category || "other";
            (groups[cat] ??= []).push(flag);
        }
        return groups;
    }, [filtered]);

    function setDraftField(key: string, field: keyof DraftValue, value: string) {
        setDrafts((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [field]: value,
            },
        }));
    }

    function handleToggle(flag: FlagRow) {
        const draft = drafts[flag.key];
        const cleanReason = (draft.reason ?? "").trim();
        if (cleanReason.length < 3) {
            setMessage({ type: "error", text: `Isi alasan dulu untuk "${flag.key}" (minimal 3 karakter).` });
            return;
        }
        if (flag.category === "trust" && draft.confirmationPhrase.toUpperCase() !== "SAYA YAKIN") {
            setMessage({ type: "error", text: `Flag trust "${flag.key}" wajib konfirmasi: ketik SAYA YAKIN.` });
            return;
        }
        const nextEnabled = !flag.enabled;
        setMessage(null);
        startTransition(async () => {
            try {
                await toggleFeatureFlag(flag.key, nextEnabled, cleanReason, {
                    confirmationPhrase: draft.confirmationPhrase || undefined,
                });
                setMessage({
                    type: "success",
                    text: `${flag.key} → ${nextEnabled ? "ENABLED" : "DISABLED"}.`,
                });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal toggle flag." });
            }
        });
    }

    function handleSave(flag: FlagRow) {
        const draft = drafts[flag.key];
        const cleanReason = (draft.reason ?? "").trim();
        if (cleanReason.length < 3) {
            setMessage({ type: "error", text: `Isi alasan dulu untuk "${flag.key}" (minimal 3 karakter).` });
            return;
        }
        setMessage(null);
        startTransition(async () => {
            try {
                await updateFeatureFlag({
                    key: flag.key,
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
                setMessage({ type: "success", text: `Konfigurasi ${flag.key} tersimpan.` });
                router.refresh();
            } catch (error) {
                setMessage({ type: "error", text: error instanceof Error ? error.message : "Gagal menyimpan flag." });
            }
        });
    }

    const totalEnabled = initialFlags.filter((f) => f.enabled).length;
    const totalTrust = initialFlags.filter((f) => f.category === "trust").length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-slate-900 uppercase flex items-center gap-3">
                            <SlidersHorizontal className="w-7 h-7 text-brand-primary" />
                            Feature Flags
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm max-w-2xl">
                            Saklar fitur untuk kontrol rollout tanpa redeploy. Toggle, atur persentase user, jadwalkan, atau matikan instan saat ada masalah.
                            <span className="text-slate-400">
                                {" "}
                                ({totalEnabled}/{initialFlags.length} aktif · {totalTrust} kategori trust)
                            </span>
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <HelpDrawer />
                        <Link
                            href="/admin/feature-flags/audit"
                            className="px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-primary hover:text-brand-primary transition-colors"
                        >
                            Audit Log
                        </Link>
                        <Link
                            href="/admin/feature-flags/kill-switch"
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 transition-colors"
                        >
                            <ShieldAlert className="w-4 h-4" />
                            Kill Switch
                        </Link>
                    </div>
                </div>

                {/* Kill switch banner */}
                <div
                    className={`rounded-xl border px-4 py-3 text-sm ${killSwitch?.active
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        }`}
                >
                    <div className="flex items-center gap-2 font-semibold">
                        {killSwitch?.active ? (
                            <ShieldAlert className="w-4 h-4" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4" />
                        )}
                        {killSwitch?.active ? `Kill-switch AKTIF (scope: ${killSwitch.scope})` : "Kill-switch nonaktif"}
                    </div>
                    {killSwitch?.active && (
                        <div className="mt-1 text-xs opacity-80">
                            Alasan: {killSwitch.reason || "-"} · Diaktifkan: {formatDate(killSwitch.activated_at)}
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari nama fitur, key, deskripsi, owner, atau tiket..."
                            className="w-full rounded-lg border border-slate-200 pl-10 pr-4 py-2 bg-slate-50 text-sm"
                        />
                    </div>
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="rounded-lg border border-slate-200 px-4 py-2 bg-slate-50 text-sm"
                    >
                        <option value="all">Semua Kategori</option>
                        <option value="pdp">📦 Halaman Produk</option>
                        <option value="trust">🛡️ Trust & Safety</option>
                        <option value="differentiator">⭐ Fitur Unggulan</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 px-4 py-2 bg-slate-50 text-sm"
                    >
                        <option value="all">Semua Status</option>
                        <option value="enabled">Hanya Aktif</option>
                        <option value="disabled">Hanya Mati</option>
                        <option value="trust">Hanya Trust</option>
                    </select>
                </div>

                {message && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm ${message.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                            }`}
                    >
                        {message.text}
                    </div>
                )}
            </div>

            {/* Grouped flags */}
            {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                    Tidak ada feature flag yang cocok dengan filter saat ini.
                </div>
            ) : (
                Object.entries(grouped).map(([cat, flagsInCat]) => {
                    const catMeta = CATEGORY_META[cat] ?? { label: cat, icon: "🚩", description: "" };
                    return (
                        <div key={cat} className="space-y-3">
                            <div className="flex items-baseline gap-2 px-1">
                                <span className="text-xl">{catMeta.icon}</span>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                                    {catMeta.label}
                                </h2>
                                <span className="text-xs text-slate-400">({flagsInCat.length})</span>
                            </div>
                            {catMeta.description && (
                                <p className="text-xs text-slate-500 px-1 -mt-1">{catMeta.description}</p>
                            )}
                            <div className="space-y-2">
                                {flagsInCat.map((flag) => (
                                    <FeatureFlagCard
                                        key={flag.key}
                                        flag={flag}
                                        meta={FEATURE_FLAG_META[flag.key] ?? null}
                                        allFlagKeys={allFlagKeys}
                                        draft={drafts[flag.key]}
                                        onDraftChange={(field, value) => setDraftField(flag.key, field, value)}
                                        onToggle={() => handleToggle(flag)}
                                        onSave={() => handleSave(flag)}
                                        isPending={isPending}
                                    />
                                ))}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
}
