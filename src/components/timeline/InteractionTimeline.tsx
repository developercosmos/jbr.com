"use client";

import { ArrowDownAZ, MessageSquare, Tag, FileText, AlertCircle, Eye, Activity } from "lucide-react";
import { useMemo, useState } from "react";

interface TimelineEvent {
    id: string;
    kind: string;
    occurredAt: string;
    actor: { id: string; role: string };
    summary: string;
    meta?: Record<string, unknown>;
}

interface Props {
    events: TimelineEvent[];
}

const KIND_LABELS: Record<string, { label: string; icon: typeof MessageSquare; color: string }> = {
    CHAT: { label: "Chat", icon: MessageSquare, color: "text-blue-600 bg-blue-50" },
    OFFER_SUBMIT: { label: "Tawaran", icon: Tag, color: "text-amber-600 bg-amber-50" },
    OFFER_COUNTER: { label: "Counter", icon: ArrowDownAZ, color: "text-purple-600 bg-purple-50" },
    OFFER_ACCEPT: { label: "Tawaran Diterima", icon: Tag, color: "text-emerald-600 bg-emerald-50" },
    OFFER_REJECT: { label: "Tawaran Ditolak", icon: Tag, color: "text-rose-600 bg-rose-50" },
    OFFER_EXPIRE: { label: "Tawaran Expire", icon: Tag, color: "text-slate-500 bg-slate-100" },
    PDP_IMPRESSION: { label: "Lihat PDP", icon: Eye, color: "text-slate-500 bg-slate-100" },
    PDP_OFFER_FOCUS: { label: "Buka Panel Tawar", icon: Activity, color: "text-slate-600 bg-slate-100" },
    ORDER_CREATED: { label: "Order Dibuat", icon: FileText, color: "text-indigo-600 bg-indigo-50" },
    DISPUTE_OPENED: { label: "Sengketa Dibuka", icon: AlertCircle, color: "text-red-600 bg-red-50" },
};

export function InteractionTimeline({ events }: Props) {
    const [filter, setFilter] = useState<string>("ALL");
    const kinds = useMemo(() => Array.from(new Set(events.map((e) => e.kind))), [events]);
    const filtered = useMemo(
        () => (filter === "ALL" ? events : events.filter((e) => e.kind === filter)),
        [events, filter]
    );

    if (events.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                Tidak ada event tercatat untuk thread ini.
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => setFilter("ALL")}
                    className={`px-3 py-1.5 text-xs rounded-full border ${filter === "ALL" ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-brand-primary"}`}
                >
                    Semua ({events.length})
                </button>
                {kinds.map((kind) => {
                    const meta = KIND_LABELS[kind] ?? { label: kind, icon: MessageSquare, color: "text-slate-600 bg-slate-50" };
                    const count = events.filter((e) => e.kind === kind).length;
                    return (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => setFilter(kind)}
                            className={`px-3 py-1.5 text-xs rounded-full border ${filter === kind ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-600 hover:border-brand-primary"}`}
                        >
                            {meta.label} ({count})
                        </button>
                    );
                })}
            </div>

            <ol className="relative border-l border-slate-200 ml-3 space-y-5">
                {filtered.map((event) => {
                    const meta = KIND_LABELS[event.kind] ?? { label: event.kind, icon: MessageSquare, color: "text-slate-600 bg-slate-50" };
                    const Icon = meta.icon;
                    return (
                        <li key={event.id} className="ml-6">
                            <span className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ${meta.color}`}>
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                        {meta.label} · {event.actor.role}
                                    </span>
                                    <time className="text-xs text-slate-400">
                                        {new Date(event.occurredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                                    </time>
                                </div>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                                    {event.summary}
                                </p>
                                {event.meta && Object.keys(event.meta).length > 0 && (
                                    <details className="mt-2 text-[11px] text-slate-500">
                                        <summary className="cursor-pointer">Detail teknis</summary>
                                        <pre className="mt-1 bg-slate-50 rounded p-2 overflow-x-auto">
                                            {JSON.stringify(event.meta, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
