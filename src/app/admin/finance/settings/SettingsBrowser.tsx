"use client";

import { useMemo, useState } from "react";
import { Search, ChevronDown, Info, AlertTriangle } from "lucide-react";
import { SettingEditor } from "@/components/admin/SettingEditor";
import { getSettingMeta } from "@/lib/accounting/setting-descriptions";

type Row = {
    key: string;
    value: unknown;
    notes: string | null;
    effective_from: string;
    updated_at: string | Date;
};

type InferredType = "string" | "number" | "boolean" | "json";

function inferType(v: unknown): InferredType {
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "number") return "number";
    if (typeof v === "string") return "string";
    return "json";
}

function groupKey(key: string): string {
    return key.split(".")[0] ?? "misc";
}

const groupLabels: Record<string, string> = {
    tax: "Pajak",
    entity: "Entitas / PKP",
    period: "Periode Akuntansi",
    fee: "Fee Platform",
    refund: "Refund",
    payout: "Payout",
    affiliate: "Affiliate",
    report: "Laporan",
    seller_export: "Export Seller",
    gl: "General Ledger",
    posting: "Posting Engine",
    seller_subledger: "Subledger Seller",
    notification: "Notifikasi",
    catalog: "Katalog",
    firstparty: "First Party (1P)",
    logistics: "Logistik",
    escrow: "Escrow",
    currency: "Mata Uang",
    recon: "Rekonsiliasi",
    isolation: "Isolation",
    audit: "Audit",
    rbac: "RBAC",
    rounding: "Rounding",
    security: "Security",
    misc: "Lain-lain",
};

const SENSITIVE_KEYS = new Set([
    "tax.ppn_rate",
    "tax.ppn_method",
    "tax.regime",
    "entity.is_pkp",
    "entity.pkp_effective_from",
    "posting.rounding_strategy",
    "posting.default_book",
    "gl.dual_write_legacy",
    "firstparty.enabled",
    "firstparty.cost_method",
]);

function formatValue(v: unknown, t: InferredType): string {
    if (t === "json") return JSON.stringify(v);
    if (t === "string") return JSON.stringify(v);
    return String(v);
}

export default function SettingsBrowser({ rows }: { rows: Row[] }) {
    const [query, setQuery] = useState("");
    const [activeGroup, setActiveGroup] = useState<string>("all");
    const [openKey, setOpenKey] = useState<string | null>(null);

    const groups = useMemo(() => {
        const map = new Map<string, Row[]>();
        for (const r of rows) {
            const g = groupKey(r.key);
            if (!map.has(g)) map.set(g, []);
            map.get(g)!.push(r);
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    }, [rows]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return groups
            .filter(([g]) => activeGroup === "all" || activeGroup === g)
            .map(([g, items]) => {
                const matched = items.filter((r) => {
                    if (!q) return true;
                    const meta = getSettingMeta(r.key);
                    return (
                        r.key.toLowerCase().includes(q) ||
                        meta.label.toLowerCase().includes(q) ||
                        meta.desc.toLowerCase().includes(q)
                    );
                });
                return [g, matched] as const;
            })
            .filter(([, items]) => items.length > 0);
    }, [groups, query, activeGroup]);

    const totalShown = filtered.reduce((acc, [, items]) => acc + items.length, 0);

    return (
        <div className="space-y-4">
            {/* Search + group chips */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sticky top-2 z-10 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Cari setting (key, label, atau deskripsi)…"
                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                    </div>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                        {totalShown} dari {rows.length}
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setActiveGroup("all")}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                            activeGroup === "all"
                                ? "bg-brand-primary text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                    >
                        Semua
                    </button>
                    {groups.map(([g, items]) => (
                        <button
                            key={g}
                            onClick={() => setActiveGroup(g)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                                activeGroup === g
                                    ? "bg-brand-primary text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                        >
                            {groupLabels[g] ?? g}
                            <span className="ml-1 opacity-60">{items.length}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Settings list */}
            {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
                    Tidak ada setting yang cocok dengan pencarian.
                </div>
            )}

            {filtered.map(([g, items]) => (
                <section key={g} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                    <header className="border-b border-slate-200 px-5 py-3 bg-slate-50/50">
                        <h2 className="font-heading text-base font-bold uppercase tracking-tight text-slate-900">
                            {groupLabels[g] ?? g}
                        </h2>
                        <p className="text-xs text-slate-500">{items.length} setting</p>
                    </header>
                    <div className="divide-y divide-slate-100">
                        {items.map((r) => {
                            const t = inferType(r.value);
                            const meta = getSettingMeta(r.key);
                            const isOpen = openKey === r.key;
                            const isSensitive = SENSITIVE_KEYS.has(r.key);

                            return (
                                <article key={r.key} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => setOpenKey(isOpen ? null : r.key)}
                                                    className="flex items-center gap-1.5 text-left group"
                                                >
                                                    <ChevronDown
                                                        className={`w-4 h-4 text-slate-400 transition-transform ${
                                                            isOpen ? "rotate-180" : ""
                                                        }`}
                                                    />
                                                    <span className="font-semibold text-slate-900 text-sm group-hover:text-brand-primary">
                                                        {meta.label}
                                                    </span>
                                                </button>
                                                {isSensitive && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Sensitif
                                                    </span>
                                                )}
                                                <code className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                    {r.key}
                                                </code>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">{meta.desc}</p>
                                        </div>

                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            <code
                                                className={`font-mono text-xs px-2 py-1 rounded max-w-[180px] truncate ${
                                                    t === "boolean"
                                                        ? r.value === true
                                                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            : "bg-slate-100 text-slate-600 border border-slate-200"
                                                        : "bg-slate-100 text-slate-700 border border-slate-200"
                                                }`}
                                                title={formatValue(r.value, t)}
                                            >
                                                {formatValue(r.value, t)}
                                            </code>
                                            <SettingEditor
                                                settingKey={r.key}
                                                currentValue={r.value}
                                                inferredType={t}
                                                notes={r.notes}
                                                effectiveFrom={String(r.effective_from)}
                                            />
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="mt-3 ml-6 pl-3 border-l-2 border-brand-primary/30 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                                            <DetailBlock title="Deskripsi" body={meta.desc} icon="info" />
                                            <DetailBlock title="Impact" body={meta.impact} icon="impact" />
                                            <DetailBlock title="Contoh" body={meta.example} mono />
                                            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1 text-[11px] text-slate-500">
                                                <div>
                                                    <span className="font-semibold text-slate-700">Effective from:</span>{" "}
                                                    {String(r.effective_from)}
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-slate-700">Updated:</span>{" "}
                                                    {new Date(r.updated_at).toLocaleString("id-ID", {
                                                        dateStyle: "short",
                                                        timeStyle: "short",
                                                    })}
                                                </div>
                                                {r.notes && (
                                                    <div className="sm:col-span-1">
                                                        <span className="font-semibold text-slate-700">Notes:</span>{" "}
                                                        {r.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}

function DetailBlock({
    title,
    body,
    icon,
    mono,
}: {
    title: string;
    body: string;
    icon?: "info" | "impact";
    mono?: boolean;
}) {
    return (
        <div>
            <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase text-[10px] tracking-wider mb-1">
                {icon === "info" && <Info className="w-3 h-3" />}
                {icon === "impact" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                {title}
            </div>
            <div className={`text-slate-700 ${mono ? "font-mono text-[11px] bg-slate-50 px-2 py-1 rounded" : ""}`}>
                {body}
            </div>
        </div>
    );
}
