"use client";

import { useState, useTransition } from "react";
import { updateAccountingSettingAction } from "@/actions/accounting/settings-admin";

type SettingType = "string" | "number" | "boolean" | "json";

interface Props {
    settingKey: string;
    currentValue: unknown;
    inferredType: SettingType;
    notes?: string | null;
    effectiveFrom?: string | null;
}

function valueToString(v: unknown, type: SettingType): string {
    if (v === null || v === undefined) return "";
    if (type === "json") return JSON.stringify(v);
    if (type === "boolean") return String(Boolean(v));
    return String(v);
}

export function SettingEditor({ settingKey, currentValue, inferredType, notes, effectiveFrom }: Props) {
    const [value, setValue] = useState(() => valueToString(currentValue, inferredType));
    const [type, setType] = useState<SettingType>(inferredType);
    const [notesText, setNotesText] = useState(notes ?? "");
    const [effFrom, setEffFrom] = useState(() => new Date().toISOString().slice(0, 10));
    const [pending, startTransition] = useTransition();
    const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [open, setOpen] = useState(false);

    function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
            const res = await updateAccountingSettingAction(fd);
            if (res.ok) {
                setMsg({ kind: "ok", text: "Tersimpan." });
                setTimeout(() => setOpen(false), 800);
            } else {
                setMsg({ kind: "err", text: res.error ?? "Gagal menyimpan." });
            }
        });
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
                Edit
            </button>
        );
    }

    return (
        <form onSubmit={submit} className="rounded-lg border border-slate-300 bg-slate-50 p-3 space-y-2 text-xs">
            <input type="hidden" name="key" value={settingKey} />
            <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Type</span>
                    <select
                        name="type"
                        value={type}
                        onChange={(e) => setType(e.target.value as SettingType)}
                        className="mt-0.5 rounded border border-slate-300 px-2 py-1"
                    >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="json">json</option>
                    </select>
                </label>
                <label className="flex flex-col flex-1 min-w-[200px]">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Value</span>
                    {type === "boolean" ? (
                        <select name="value" value={value} onChange={(e) => setValue(e.target.value)} className="mt-0.5 rounded border border-slate-300 px-2 py-1">
                            <option value="true">true</option>
                            <option value="false">false</option>
                        </select>
                    ) : type === "json" ? (
                        <textarea name="value" value={value} onChange={(e) => setValue(e.target.value)} rows={3} className="mt-0.5 font-mono rounded border border-slate-300 px-2 py-1" />
                    ) : (
                        <input
                            name="value"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            className="mt-0.5 rounded border border-slate-300 px-2 py-1"
                        />
                    )}
                </label>
                <label className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Effective From</span>
                    <input type="date" name="effective_from" value={effFrom} onChange={(e) => setEffFrom(e.target.value)} className="mt-0.5 rounded border border-slate-300 px-2 py-1" />
                </label>
            </div>
            <label className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">Notes</span>
                <input name="notes" value={notesText} onChange={(e) => setNotesText(e.target.value)} placeholder={effectiveFrom ? `Sebelumnya berlaku sejak ${effectiveFrom}` : ""} className="mt-0.5 rounded border border-slate-300 px-2 py-1" />
            </label>
            <div className="flex items-center justify-between">
                <div>
                    {msg && (
                        <span className={msg.kind === "ok" ? "text-green-700 font-semibold" : "text-red-700 font-semibold"}>
                            {msg.text}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => setOpen(false)} className="rounded bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-300">Batal</button>
                    <button type="submit" disabled={pending} className="rounded bg-brand-primary px-3 py-1 font-semibold text-white disabled:opacity-50">
                        {pending ? "Menyimpan..." : "Simpan"}
                    </button>
                </div>
            </div>
        </form>
    );
}
