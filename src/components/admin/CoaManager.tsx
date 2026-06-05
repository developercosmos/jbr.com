"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check, AlertTriangle, Pencil } from "lucide-react";
import { createCoaAccount, updateCoaAccount, type CoaAccountRow } from "@/actions/accounting/coa";

const CLASSES = [
    "ASSET", "LIABILITY", "EQUITY", "REVENUE", "CONTRA_REVENUE",
    "COGS", "OPEX", "OTHER_INCOME", "OTHER_EXPENSE", "TAX_EXPENSE",
] as const;

// Conventional normal balance per class — mirrors the server validation so the
// form auto-fills and the admin gets immediate feedback.
const EXPECTED_NORMAL: Record<string, "DEBIT" | "CREDIT"> = {
    ASSET: "DEBIT", LIABILITY: "CREDIT", EQUITY: "CREDIT", REVENUE: "CREDIT",
    CONTRA_REVENUE: "DEBIT", COGS: "DEBIT", OPEX: "DEBIT",
    OTHER_INCOME: "CREDIT", OTHER_EXPENSE: "DEBIT", TAX_EXPENSE: "DEBIT",
};

export default function CoaManager({ accounts }: { accounts: CoaAccountRow[] }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);

    // create form state
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [klass, setKlass] = useState<string>("ASSET");
    const [normal, setNormal] = useState<"DEBIT" | "CREDIT">("DEBIT");
    const [book, setBook] = useState<"PLATFORM" | "SELLER">("PLATFORM");
    const [desc, setDesc] = useState("");

    function onClassChange(c: string) {
        setKlass(c);
        setNormal(EXPECTED_NORMAL[c] ?? "DEBIT");
    }

    function resetCreate() {
        setCode(""); setName(""); setKlass("ASSET"); setNormal("DEBIT"); setBook("PLATFORM"); setDesc("");
        setShowCreate(false);
    }

    function handleCreate() {
        setMsg(null);
        startTransition(async () => {
            const res = await createCoaAccount({
                code, name, class: klass as never, normal_balance: normal, book, is_postable: true,
                description: desc || undefined,
            });
            if (res.success) {
                setMsg({ type: "ok", text: `Akun ${code} dibuat.` });
                resetCreate();
                router.refresh();
            } else {
                setMsg({ type: "err", text: res.error });
            }
        });
    }

    return (
        <div className="space-y-4">
            {msg && (
                <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${msg.type === "ok"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {msg.type === "ok" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {msg.text}
                </div>
            )}

            <div className="flex justify-between items-center">
                <p className="text-sm text-slate-500">{accounts.length} akun</p>
                <button
                    onClick={() => setShowCreate((s) => !s)}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-white hover:bg-blue-600"
                >
                    <Plus className="w-4 h-4" /> Akun Baru
                </button>
            </div>

            {showCreate && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                    <h3 className="font-bold text-slate-900">Buat Akun GL</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Kode (4–10 digit)</label>
                            <input value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                                placeholder="mis. 11200" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Nama</label>
                            <input value={name} onChange={(e) => setName(e.target.value)}
                                placeholder="mis. Kas Operasional (BCA)" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label>
                            <select value={klass} onChange={(e) => onClassChange(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Saldo Normal</label>
                            <select value={normal} onChange={(e) => setNormal(e.target.value as "DEBIT" | "CREDIT")}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                <option value="DEBIT">DEBIT</option>
                                <option value="CREDIT">CREDIT</option>
                            </select>
                            <p className="text-[11px] text-slate-400 mt-1">Disarankan {EXPECTED_NORMAL[klass]} untuk kelas {klass}.</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Book</label>
                            <select value={book} onChange={(e) => setBook(e.target.value as "PLATFORM" | "SELLER")}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                                <option value="PLATFORM">PLATFORM</option>
                                <option value="SELLER">SELLER</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Deskripsi (opsional)</label>
                            <input value={desc} onChange={(e) => setDesc(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={resetCreate} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">Batal</button>
                        <button onClick={handleCreate} disabled={isPending || !code || !name}
                            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Simpan
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                            <th className="px-3 py-2 text-left">Kode</th>
                            <th className="px-3 py-2 text-left">Nama</th>
                            <th className="px-3 py-2 text-left">Kelas</th>
                            <th className="px-3 py-2 text-left">Saldo</th>
                            <th className="px-3 py-2 text-left">Book</th>
                            <th className="px-3 py-2 text-center">Postable</th>
                            <th className="px-3 py-2 text-center">Aktif</th>
                            <th className="px-3 py-2 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {accounts.map((a) => (
                            <CoaRow key={a.id} account={a} editing={editId === a.id}
                                onEdit={() => setEditId(a.id)} onCancel={() => setEditId(null)}
                                onSaved={() => { setEditId(null); router.refresh(); }}
                                onMessage={setMsg} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function CoaRow({ account, editing, onEdit, onCancel, onSaved, onMessage }: {
    account: CoaAccountRow;
    editing: boolean;
    onEdit: () => void;
    onCancel: () => void;
    onSaved: () => void;
    onMessage: (m: { type: "ok" | "err"; text: string }) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState(account.name);
    const [description, setDescription] = useState(account.description ?? "");
    const [isPostable, setIsPostable] = useState(account.isPostable);
    const [isActive, setIsActive] = useState(account.isActive);

    function save() {
        startTransition(async () => {
            const res = await updateCoaAccount({ id: account.id, name, description: description || undefined, is_postable: isPostable, is_active: isActive });
            if (res.success) { onMessage({ type: "ok", text: `Akun ${account.code} diperbarui.` }); onSaved(); }
            else onMessage({ type: "err", text: res.error });
        });
    }

    if (!editing) {
        return (
            <tr className={account.isActive ? "" : "opacity-50"}>
                <td className="px-3 py-2 font-mono">{account.code}</td>
                <td className="px-3 py-2">{account.name}{account.inUse && <span className="ml-2 text-[10px] text-slate-400">(terpakai)</span>}</td>
                <td className="px-3 py-2 text-xs">{account.class_}</td>
                <td className="px-3 py-2 text-xs">{account.normalBalance}</td>
                <td className="px-3 py-2 text-xs">{account.book}</td>
                <td className="px-3 py-2 text-center">{account.isPostable ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-center">{account.isActive ? "✓" : "—"}</td>
                <td className="px-3 py-2 text-right">
                    <button onClick={onEdit} className="inline-flex items-center gap-1 text-brand-primary hover:underline text-xs">
                        <Pencil className="w-3 h-3" /> Edit
                    </button>
                </td>
            </tr>
        );
    }

    return (
        <tr className="bg-blue-50/40">
            <td className="px-3 py-2 font-mono text-slate-400">{account.code}</td>
            <td className="px-3 py-2"><input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1 text-sm" /></td>
            <td className="px-3 py-2 text-xs text-slate-400">{account.class_}</td>
            <td className="px-3 py-2 text-xs text-slate-400">{account.normalBalance}</td>
            <td className="px-3 py-2 text-xs text-slate-400">{account.book}</td>
            <td className="px-3 py-2 text-center"><input type="checkbox" checked={isPostable} onChange={(e) => setIsPostable(e.target.checked)} /></td>
            <td className="px-3 py-2 text-center"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /></td>
            <td className="px-3 py-2 text-right whitespace-nowrap">
                <button onClick={onCancel} className="text-xs text-slate-500 mr-2">Batal</button>
                <button onClick={save} disabled={isPending} className="inline-flex items-center gap-1 text-xs font-bold text-brand-primary disabled:opacity-50">
                    {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Simpan
                </button>
            </td>
        </tr>
    );
}
