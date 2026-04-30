"use client";

import { useState } from "react";
import { HelpCircle, X, BookOpen } from "lucide-react";
import { GLOSSARY } from "@/lib/feature-flag-metadata";

export function HelpDrawer() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-sm transition-colors"
            >
                <HelpCircle className="w-4 h-4" />
                Bantuan
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
                    <div
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />
                    <aside className="ml-auto relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
                        <header className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <BookOpen className="w-5 h-5 text-brand-primary" />
                                Glossary Feature Flag
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100"
                                aria-label="Tutup"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            <p className="text-sm text-slate-600">
                                Halaman Feature Flags adalah tempat admin mengelola fitur baru tanpa
                                perlu redeploy server. Berikut istilah kunci yang perlu dipahami.
                            </p>

                            <ul className="space-y-4">
                                {GLOSSARY.map((entry) => (
                                    <li key={entry.term} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="font-semibold text-slate-900 text-sm">
                                            {entry.term}
                                        </div>
                                        <div className="text-xs text-slate-500 italic mt-0.5">{entry.short}</div>
                                        <div className="text-sm text-slate-700 mt-2 leading-relaxed">
                                            {entry.long}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                <div className="font-semibold mb-1">💡 Tips Rollout</div>
                                <ol className="list-decimal pl-5 space-y-1">
                                    <li>Toggle <b>Enable</b> dulu (master switch ON).</li>
                                    <li>Set <b>Rollout %</b> bertahap: 10 → 50 → 100.</li>
                                    <li>Untuk dogfood, set <b>Audience roles: ADMIN</b> dulu.</li>
                                    <li>Monitor 7 hari, lalu klik <b>Impact</b> di setiap flag untuk lihat metrik.</li>
                                    <li>Bila bermasalah: kembalikan rollout ke 0 atau aktifkan <b>Kill Switch</b>.</li>
                                </ol>
                            </div>
                        </div>
                    </aside>
                </div>
            )}
        </>
    );
}
