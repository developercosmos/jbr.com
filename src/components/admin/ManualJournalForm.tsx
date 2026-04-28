"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { CoaOption } from "@/actions/accounting/manual-journal";
import { postManualJournalAction } from "@/actions/accounting/manual-journal";

interface Line {
    id: number;
    accountCode: string;
    debit: string;
    credit: string;
    memo: string;
}

interface Props {
    accounts: CoaOption[];
    okJournalNo?: string;
}

let nextId = 1;
function newLine(): Line {
    return { id: nextId++, accountCode: "", debit: "", credit: "", memo: "" };
}

export default function ManualJournalForm({ accounts, okJournalNo }: Props) {
    const [lines, setLines] = useState<Line[]>(() => [newLine(), newLine()]);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const totals = useMemo(() => {
        let d = 0, c = 0;
        for (const ln of lines) {
            d += Number(ln.debit) || 0;
            c += Number(ln.credit) || 0;
        }
        return { d, c, drift: Math.round((d - c) * 100) / 100 };
    }, [lines]);

    const balanced = Math.abs(totals.drift) < 0.01 && totals.d > 0;

    function update(id: number, field: keyof Line, value: string) {
        setLines((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
    }

    function remove(id: number) {
        setLines((prev) => (prev.length <= 2 ? prev : prev.filter((l) => l.id !== id)));
    }

    async function onSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!balanced) {
            setError("Journal must be balanced (debit = kredit, > 0).");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            const fd = new FormData(e.currentTarget);
            fd.set("line_count", String(lines.length));
            lines.forEach((ln, i) => {
                fd.set(`line[${i}][account_code]`, ln.accountCode);
                fd.set(`line[${i}][debit]`, ln.debit || "0");
                fd.set(`line[${i}][credit]`, ln.credit || "0");
                fd.set(`line[${i}][memo]`, ln.memo);
            });
            await postManualJournalAction(fd);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSubmitting(false);
        }
    }

    const today = new Date().toISOString().slice(0, 10);

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {okJournalNo && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    Jurnal <code className="font-mono font-bold">{okJournalNo}</code> berhasil di-post.
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium uppercase text-slate-600">Description *</span>
                    <input
                        name="description"
                        required
                        placeholder="Mis. Penyesuaian akrual gaji bulan April"
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium uppercase text-slate-600">Posted at</span>
                    <input
                        type="date"
                        name="posted_at"
                        defaultValue={today}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium uppercase text-slate-600">Ref type</span>
                    <input name="ref_type" placeholder="ADJUSTMENT, ACCRUAL, …" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1 sm:col-span-2">
                    <span className="text-xs font-medium uppercase text-slate-600">Ref id</span>
                    <input name="ref_id" placeholder="Free-form (optional)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
                </label>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                        <tr>
                            <th className="px-3 py-2 text-left">Akun</th>
                            <th className="px-3 py-2 text-right w-36">Debit</th>
                            <th className="px-3 py-2 text-right w-36">Kredit</th>
                            <th className="px-3 py-2 text-left">Memo</th>
                            <th className="px-3 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {lines.map((ln) => (
                            <tr key={ln.id} className="border-t border-slate-100 align-top">
                                <td className="px-3 py-2">
                                    <select
                                        value={ln.accountCode}
                                        onChange={(e) => update(ln.id, "accountCode", e.target.value)}
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                    >
                                        <option value="">— Pilih akun —</option>
                                        {accounts.map((a) => (
                                            <option key={a.code} value={a.code}>
                                                {a.code} — {a.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        inputMode="decimal"
                                        value={ln.debit}
                                        onChange={(e) => update(ln.id, "debit", e.target.value.replace(/[^\d.]/g, ""))}
                                        placeholder="0"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right font-mono"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        inputMode="decimal"
                                        value={ln.credit}
                                        onChange={(e) => update(ln.id, "credit", e.target.value.replace(/[^\d.]/g, ""))}
                                        placeholder="0"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-right font-mono"
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <input
                                        value={ln.memo}
                                        onChange={(e) => update(ln.id, "memo", e.target.value)}
                                        placeholder="Catatan baris (opsional)"
                                        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                                    />
                                </td>
                                <td className="px-3 py-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => remove(ln.id)}
                                        disabled={lines.length <= 2}
                                        className="text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-400"
                                        aria-label="Hapus baris"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-slate-50 text-sm">
                        <tr>
                            <td className="px-3 py-2 text-right font-medium">Total</td>
                            <td className="px-3 py-2 text-right font-mono">{totals.d.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right font-mono">{totals.c.toFixed(2)}</td>
                            <td className={`px-3 py-2 font-mono ${balanced ? "text-emerald-600" : "text-red-600 font-bold"}`}>
                                Drift: {totals.drift.toFixed(2)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => setLines((p) => [...p, newLine()])}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
                >
                    <Plus className="w-4 h-4" /> Tambah baris
                </button>
                <button
                    type="submit"
                    disabled={submitting || !balanced}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    {submitting ? "Posting…" : "Post Journal"}
                </button>
            </div>

            {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
                    {error}
                </div>
            )}
        </form>
    );
}
