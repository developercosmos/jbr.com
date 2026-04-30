"use client";

import { useState } from "react";
import Link from "next/link";
import {
    ChevronDown,
    ChevronUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Lock,
    Save,
    Loader2,
    BarChart3,
    ExternalLink,
} from "lucide-react";
import type { FeatureFlagMetadata, FlagRisk } from "@/lib/feature-flag-metadata";

export interface FlagRow {
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
}

interface DraftValue {
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
}

interface Props {
    flag: FlagRow;
    meta: FeatureFlagMetadata | null;
    allFlagKeys: string[];
    draft: DraftValue;
    onDraftChange: (field: keyof DraftValue, value: string) => void;
    onToggle: () => void;
    onSave: () => void;
    isPending: boolean;
}

const RISK_STYLES: Record<FlagRisk, { label: string; classes: string }> = {
    low: { label: "Risiko Rendah", classes: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    medium: { label: "Risiko Sedang", classes: "bg-amber-100 text-amber-700 border-amber-200" },
    high: { label: "Risiko Tinggi", classes: "bg-rose-100 text-rose-700 border-rose-200" },
};

function statusBadge(flag: FlagRow): { label: string; classes: string } {
    if (!flag.enabled) {
        return { label: "Mati", classes: "bg-slate-200 text-slate-700" };
    }
    if (flag.rollout_pct >= 100) {
        return { label: "Aktif Penuh", classes: "bg-emerald-500 text-white" };
    }
    if (flag.rollout_pct > 0) {
        return { label: `${flag.rollout_pct}% rollout`, classes: "bg-blue-500 text-white" };
    }
    const audience = flag.audience ?? {};
    if (audience.roles?.length || audience.userIds?.length || audience.cohorts?.length) {
        return { label: "Audience-only", classes: "bg-purple-500 text-white" };
    }
    return { label: "Aktif (0%)", classes: "bg-amber-500 text-white" };
}

export function FeatureFlagCard({
    flag,
    meta,
    allFlagKeys,
    draft,
    onDraftChange,
    onToggle,
    onSave,
    isPending,
}: Props) {
    const [expanded, setExpanded] = useState(false);
    const friendlyName = meta?.friendlyName ?? flag.key;
    const icon = meta?.icon ?? "🚩";
    const risk = RISK_STYLES[meta?.risk ?? "medium"];
    const status = statusBadge(flag);
    const isTrust = flag.category === "trust";

    return (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Compact header row */}
            <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                    aria-expanded={expanded}
                >
                    <span className="text-2xl flex-shrink-0">{icon}</span>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 truncate">{friendlyName}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status.classes}`}>
                                {status.label}
                            </span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${risk.classes}`}>
                                {risk.label}
                            </span>
                            {isTrust && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                    <Lock className="w-3 h-3" />
                                    Trust
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="font-mono">{flag.key}</span>
                            {meta && <> · {meta.ticket}</>}
                        </div>
                    </div>
                    {expanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </button>
                <Link
                    href={`/admin/feature-flags/${encodeURIComponent(flag.key)}/impact`}
                    className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Impact
                </Link>
                <button
                    type="button"
                    disabled={isPending}
                    onClick={onToggle}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-colors ${flag.enabled ? "bg-rose-600 text-white hover:bg-rose-700" : "bg-brand-primary text-white hover:bg-brand-primary/90"}`}
                >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : flag.enabled ? "Disable" : "Enable"}
                </button>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5">
                    {/* What is this */}
                    {meta && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div className="rounded-lg bg-white border border-slate-200 p-4">
                                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                                    Apa Ini?
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">{meta.description}</p>
                                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                    <span>📍 {meta.affectedSurface}</span>
                                </div>
                            </div>

                            <div className="rounded-lg bg-white border border-slate-200 p-4">
                                <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">
                                    Dampak Bisnis
                                </div>
                                <ul className="space-y-1.5 text-sm">
                                    {meta.impact.positive.map((item, i) => (
                                        <li key={`pos-${i}`} className="flex items-start gap-2 text-emerald-700">
                                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                    {meta.impact.risk.map((item, i) => (
                                        <li key={`risk-${i}`} className="flex items-start gap-2 text-amber-700">
                                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                            <span className="text-slate-700">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Dependency warning */}
                    {meta?.dependencies && meta.dependencies.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5" />
                            <div>
                                <div className="font-semibold text-amber-900">Butuh fitur lain aktif duluan</div>
                                <div className="text-amber-800 text-xs mt-1">
                                    Pastikan flag berikut sudah enabled sebelum mengaktifkan ini:{" "}
                                    {meta.dependencies.map((dep, i) => (
                                        <span key={dep}>
                                            <code className="font-mono bg-amber-100 px-1 rounded">{dep}</code>
                                            {i < meta.dependencies!.length - 1 && ", "}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Trust confirmation banner */}
                    {isTrust && (
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm flex items-start gap-2">
                            <Lock className="w-4 h-4 text-rose-700 mt-0.5" />
                            <div>
                                <div className="font-semibold text-rose-900">Flag kategori Trust</div>
                                <div className="text-rose-800 text-xs mt-1">
                                    Toggle wajib ketik <b>SAYA YAKIN</b> di field konfirmasi di bawah. Perubahan
                                    di-log untuk audit trust.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Settings — collapsible advanced */}
                    <details className="rounded-lg bg-white border border-slate-200 group">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700 flex items-center justify-between hover:bg-slate-50">
                            <span>⚙️ Pengaturan Advanced (Rollout, Audience, Variants)</span>
                            <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-slate-100">
                            {/* Rollout + Owner + Parent */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Rollout %</span>
                                    <span className="block text-[11px] text-slate-500">% pengguna yang lihat fitur</span>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={draft.rolloutPct}
                                        onChange={(e) => onDraftChange("rolloutPct", e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                    />
                                </label>
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Owner / PIC</span>
                                    <span className="block text-[11px] text-slate-500">Engineer/PM penanggung jawab</span>
                                    <input
                                        type="text"
                                        value={draft.owner}
                                        onChange={(e) => onDraftChange("owner", e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                    />
                                </label>
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Parent Flag</span>
                                    <span className="block text-[11px] text-slate-500">Flag yang harus aktif duluan</span>
                                    <select
                                        value={draft.parentKey}
                                        onChange={(e) => onDraftChange("parentKey", e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                    >
                                        <option value="">Tanpa parent</option>
                                        {allFlagKeys
                                            .filter((k) => k !== flag.key)
                                            .map((k) => (
                                                <option key={k} value={k}>
                                                    {k}
                                                </option>
                                            ))}
                                    </select>
                                </label>
                            </div>

                            {/* Schedule */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Auto-Aktifkan (jadwal)
                                    </span>
                                    <input
                                        type="datetime-local"
                                        value={draft.scheduledEnableAt}
                                        onChange={(e) => onDraftChange("scheduledEnableAt", e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                    />
                                </label>
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Auto-Matikan (jadwal)
                                    </span>
                                    <input
                                        type="datetime-local"
                                        value={draft.scheduledDisableAt}
                                        onChange={(e) => onDraftChange("scheduledDisableAt", e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                    />
                                </label>
                            </div>

                            {/* Audience */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Audience: roles</span>
                                    <span className="block text-[11px] text-slate-500">CSV. Mis: ADMIN, BETA</span>
                                    <input
                                        type="text"
                                        value={draft.roles}
                                        onChange={(e) => onDraftChange("roles", e.target.value)}
                                        placeholder="ADMIN, STAFF, BETA"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                    />
                                </label>
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Audience: userIds</span>
                                    <span className="block text-[11px] text-slate-500">CSV ID user spesifik</span>
                                    <input
                                        type="text"
                                        value={draft.userIds}
                                        onChange={(e) => onDraftChange("userIds", e.target.value)}
                                        placeholder="usr_abc, usr_xyz"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                    />
                                </label>
                                <label className="text-sm space-y-1">
                                    <span className="font-medium text-slate-700">Audience: cohorts</span>
                                    <span className="block text-[11px] text-slate-500">CSV nama kelompok</span>
                                    <input
                                        type="text"
                                        value={draft.cohorts}
                                        onChange={(e) => onDraftChange("cohorts", e.target.value)}
                                        placeholder="beta-pdp, internal"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                    />
                                </label>
                            </div>

                            {/* Variants */}
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Variants A/B/C</span>
                                <span className="block text-[11px] text-slate-500">
                                    Format: name=weight, total ≤ 100. Mis: control=50, variant_a=50
                                </span>
                                <input
                                    type="text"
                                    value={draft.variants}
                                    onChange={(e) => onDraftChange("variants", e.target.value)}
                                    placeholder="control=50, variant_a=50"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 font-mono text-xs"
                                />
                            </label>

                            {/* Notes */}
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">Notes (internal)</span>
                                <textarea
                                    rows={2}
                                    value={draft.notes}
                                    onChange={(e) => onDraftChange("notes", e.target.value)}
                                    placeholder="Catatan untuk tim, mis: 'mulai 50% rollout 2026-05-15'"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50 resize-none"
                                />
                            </label>
                        </div>
                    </details>

                    {/* Save bar (always visible when expanded) */}
                    <div className="rounded-lg bg-white border border-slate-200 p-4 space-y-3">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            <label className="block text-sm space-y-1">
                                <span className="font-medium text-slate-700">
                                    Alasan perubahan <span className="text-rose-600">*</span>
                                </span>
                                <span className="block text-[11px] text-slate-500">
                                    Wajib diisi (≥ 3 karakter). Tercatat di audit log.
                                </span>
                                <input
                                    type="text"
                                    value={draft.reason}
                                    onChange={(e) => onDraftChange("reason", e.target.value)}
                                    placeholder="Mis: rollout bertahap fase 2, target naik ke 50%"
                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 bg-slate-50"
                                />
                            </label>
                            {isTrust && (
                                <label className="block text-sm space-y-1">
                                    <span className="font-medium text-rose-700 flex items-center gap-1">
                                        <Lock className="w-3.5 h-3.5" />
                                        Konfirmasi Trust <span className="text-rose-600">*</span>
                                    </span>
                                    <span className="block text-[11px] text-slate-500">Ketik: SAYA YAKIN</span>
                                    <input
                                        type="text"
                                        value={draft.confirmationPhrase}
                                        onChange={(e) => onDraftChange("confirmationPhrase", e.target.value)}
                                        placeholder="SAYA YAKIN"
                                        className="w-full rounded-lg border border-rose-300 px-3 py-2 bg-rose-50 font-mono text-xs"
                                    />
                                </label>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <Link
                                href={`/admin/feature-flags/${encodeURIComponent(flag.key)}/impact`}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-primary"
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                Lihat metrik impact
                                <ExternalLink className="w-3 h-3" />
                            </Link>
                            <button
                                type="button"
                                disabled={isPending}
                                onClick={onSave}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 transition-colors text-sm"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Simpan Perubahan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
