"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertTriangle, RotateCcw } from "lucide-react";
import { setAccountMapping } from "@/actions/accounting/coa";
import type { AccountSlotState } from "@/actions/accounting/account-map-registry";
import type { CoaAccountRow } from "@/actions/accounting/coa";

/**
 * Admin UI to point each auto-posting "slot" at a specific CoA account.
 *
 * Zero-risk: a slot with no override resolves to its original hardcoded default,
 * so posting behaves exactly like before until an admin changes it here.
 */
export default function AccountMappingManager({
    slots,
    accounts,
}: {
    slots: AccountSlotState[];
    accounts: CoaAccountRow[];
}) {
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    // Group slots by their `group` for a sectioned layout, preserving registry order.
    const groups = useMemo(() => {
        const order: string[] = [];
        const map = new Map<string, AccountSlotState[]>();
        for (const s of slots) {
            if (!map.has(s.group)) {
                map.set(s.group, []);
                order.push(s.group);
            }
            map.get(s.group)!.push(s);
        }
        return order.map((g) => ({ group: g, items: map.get(g)! }));
    }, [slots]);

    return (
        <div className="space-y-4">
            {msg && (
                <div
                    className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
                        msg.type === "ok"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                >
                    {msg.type === "ok" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            {groups.map(({ group, items }) => (
                <div key={group} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                        {group}
                    </div>
                    <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-100">
                            {items.map((s) => (
                                <MappingRow
                                    key={s.slot}
                                    slot={s}
                                    accounts={accounts}
                                    onMessage={setMsg}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            ))}
        </div>
    );
}

function MappingRow({
    slot,
    accounts,
    onMessage,
}: {
    slot: AccountSlotState;
    accounts: CoaAccountRow[];
    onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [selected, setSelected] = useState(slot.currentCode);

    // If the currently-effective code isn't an active+postable account (e.g. it was
    // deactivated), still show it as an option so the select reflects reality.
    const hasCurrent = accounts.some((a) => a.code === slot.currentCode);

    const isCustom = slot.currentCode !== slot.defaultCode;
    const dirty = selected !== slot.currentCode;

    function save(code: string) {
        onMessage({ type: "ok", text: "" }); // clear
        startTransition(async () => {
            const res = await setAccountMapping({ slot: slot.slot, code });
            if (res.success) {
                onMessage({ type: "ok", text: `Slot "${slot.label}" → akun ${code} disimpan.` });
                router.refresh();
            } else {
                onMessage({ type: "err", text: res.error });
                setSelected(slot.currentCode); // revert selection on failure
            }
        });
    }

    return (
        <tr>
            <td className="px-4 py-3 align-top">
                <div className="font-medium text-slate-800">{slot.label}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                    {isCustom ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-700">
                            Custom
                        </span>
                    ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500">
                            Default
                        </span>
                    )}
                    <span className="text-slate-400">default {slot.defaultCode}</span>
                    {slot.note && <span className="text-slate-400">· {slot.note}</span>}
                </div>
            </td>
            <td className="px-4 py-3 align-top">
                <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={isPending}
                    className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:opacity-50"
                >
                    {!hasCurrent && (
                        <option value={slot.currentCode}>
                            {slot.currentCode} — (tidak aktif / di luar daftar)
                        </option>
                    )}
                    {accounts.map((a) => (
                        <option key={a.id} value={a.code}>
                            {a.code} — {a.name}
                        </option>
                    ))}
                </select>
            </td>
            <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                {isCustom && (
                    <button
                        type="button"
                        onClick={() => {
                            setSelected(slot.defaultCode);
                            save(slot.defaultCode);
                        }}
                        disabled={isPending}
                        className="mr-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 disabled:opacity-50"
                        title={`Kembalikan ke default (${slot.defaultCode})`}
                    >
                        <RotateCcw className="w-3 h-3" /> Default
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => save(selected)}
                    disabled={isPending || !dirty}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Simpan
                </button>
            </td>
        </tr>
    );
}
