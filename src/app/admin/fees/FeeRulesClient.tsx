"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Calculator, Archive } from "lucide-react";
import { archiveFeeRule, createFeeRule, simulateFee } from "@/actions/fees";

type Mode = "PERCENT" | "FIXED" | "TIERED";
type ValueMode = "PERCENT" | "FIXED";
type Tier = "T0" | "T1" | "T2";

interface BracketDraft {
    min_price: number;
    max_price: number | null;
    value: number;
    value_mode: ValueMode;
}

interface FeeRule {
    id: string;
    name: string;
    scope_category_id: string | null;
    scope_seller_tier: string | null;
    valid_from: string;
    valid_to: string | null;
    priority: number;
    is_active: boolean;
    mode: Mode;
    default_value: number;
    brackets: Array<{
        id: string;
        min_price: number;
        max_price: number | null;
        value: number;
        value_mode: ValueMode;
    }>;
}

interface CategoryOption {
    id: string;
    name: string;
}

interface Props {
    initialRules: FeeRule[];
    categories: CategoryOption[];
}

interface SimulationResult {
    fee: number;
    breakdown: {
        ruleId: string;
        ruleName: string;
        mode: Mode;
        formula: string;
    } | null;
}

export default function FeeRulesClient({ initialRules, categories }: Props) {
    const router = useRouter();

    const [name, setName] = useState("");
    const [mode, setMode] = useState<Mode>("PERCENT");
    const [defaultValue, setDefaultValue] = useState<string>("0");
    const [scopeCategoryId, setScopeCategoryId] = useState<string>("");
    const [scopeTier, setScopeTier] = useState<string>("");
    const [priority, setPriority] = useState<number>(100);
    const [brackets, setBrackets] = useState<BracketDraft[]>([
        { min_price: 0, max_price: null, value: 0, value_mode: "PERCENT" },
    ]);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createSuccess, setCreateSuccess] = useState<string | null>(null);
    const [isCreating, startCreate] = useTransition();

    const [simPrice, setSimPrice] = useState<string>("100000");
    const [simCategory, setSimCategory] = useState<string>("");
    const [simTier, setSimTier] = useState<Tier>("T0");
    const [simResult, setSimResult] = useState<SimulationResult | null>(null);
    const [simError, setSimError] = useState<string | null>(null);
    const [isSimulating, startSimulate] = useTransition();

    function updateBracket(index: number, patch: Partial<BracketDraft>) {
        setBrackets((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    }
    function addBracket() {
        setBrackets((prev) => [
            ...prev,
            {
                min_price: prev[prev.length - 1]?.max_price ?? 0,
                max_price: null,
                value: 0,
                value_mode: "PERCENT",
            },
        ]);
    }
    function removeBracket(index: number) {
        setBrackets((prev) => prev.filter((_, i) => i !== index));
    }

    function handleCreate() {
        setCreateError(null);
        setCreateSuccess(null);
        if (!name.trim()) {
            setCreateError("Nama wajib diisi.");
            return;
        }
        const numericDefault = Number(defaultValue);
        if (Number.isNaN(numericDefault) || numericDefault < 0) {
            setCreateError("Default value harus angka ≥ 0.");
            return;
        }
        startCreate(async () => {
            try {
                await createFeeRule({
                    name: name.trim(),
                    scope_category_id: scopeCategoryId || null,
                    scope_seller_tier: (scopeTier || null) as Tier | null,
                    priority,
                    is_active: true,
                    mode,
                    default_value: numericDefault,
                    brackets: mode === "TIERED" ? brackets : undefined,
                });
                setCreateSuccess(`Rule "${name}" berhasil dibuat.`);
                setName("");
                setDefaultValue("0");
                router.refresh();
            } catch (err) {
                setCreateError(err instanceof Error ? err.message : "Gagal membuat rule.");
            }
        });
    }

    function handleArchive(ruleId: string) {
        if (!confirm("Arsipkan rule ini? Order yang sudah ada tidak terpengaruh.")) return;
        startCreate(async () => {
            try {
                await archiveFeeRule(ruleId);
                router.refresh();
            } catch (err) {
                console.error(err);
            }
        });
    }

    function handleSimulate() {
        setSimError(null);
        setSimResult(null);
        const price = Number(simPrice);
        if (Number.isNaN(price) || price < 0) {
            setSimError("Harga harus angka ≥ 0.");
            return;
        }
        startSimulate(async () => {
            try {
                const result = await simulateFee({
                    price,
                    categoryId: simCategory || null,
                    sellerTier: simTier,
                });
                setSimResult({
                    fee: result.fee,
                    breakdown: result.breakdown
                        ? {
                            ruleId: result.breakdown.ruleId,
                            ruleName: result.breakdown.ruleName,
                            mode: result.breakdown.mode,
                            formula: result.breakdown.formula,
                        }
                        : null,
                });
            } catch (err) {
                setSimError(err instanceof Error ? err.message : "Simulasi gagal.");
            }
        });
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Create form */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-brand-primary" />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Buat Rule Baru</h2>
                    </div>
                    <div className="p-5 space-y-3 text-sm">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Nama</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Contoh: Default fee, Promo raket bekas"
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20 text-slate-900 dark:text-white"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Mode</label>
                                <select
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as Mode)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                >
                                    <option value="PERCENT">PERCENT</option>
                                    <option value="FIXED">FIXED</option>
                                    <option value="TIERED">TIERED</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">
                                    {mode === "PERCENT" ? "Nilai %" : mode === "FIXED" ? "Nilai (IDR)" : "Default Fallback"}
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={defaultValue}
                                    onChange={(e) => setDefaultValue(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Kategori (opsional)</label>
                                <select
                                    value={scopeCategoryId}
                                    onChange={(e) => setScopeCategoryId(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                >
                                    <option value="">Semua kategori</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Tier (opsional)</label>
                                <select
                                    value={scopeTier}
                                    onChange={(e) => setScopeTier(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                >
                                    <option value="">Semua tier</option>
                                    <option value="T0">T0</option>
                                    <option value="T1">T1</option>
                                    <option value="T2">T2</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Priority (besar = menang lebih dulu)</label>
                            <input
                                type="number"
                                value={priority}
                                onChange={(e) => setPriority(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                            />
                        </div>

                        {mode === "TIERED" && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Brackets harga</div>
                                {brackets.map((b, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                                        <div className="col-span-3">
                                            <label className="text-[11px] text-slate-500">Min</label>
                                            <input
                                                type="number"
                                                value={b.min_price}
                                                onChange={(e) => updateBracket(i, { min_price: Number(e.target.value) })}
                                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-black/20 text-xs"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[11px] text-slate-500">Max (kosong = ∞)</label>
                                            <input
                                                type="number"
                                                value={b.max_price ?? ""}
                                                onChange={(e) =>
                                                    updateBracket(i, {
                                                        max_price: e.target.value === "" ? null : Number(e.target.value),
                                                    })
                                                }
                                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-black/20 text-xs"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <label className="text-[11px] text-slate-500">Value</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={b.value}
                                                onChange={(e) => updateBracket(i, { value: Number(e.target.value) })}
                                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-black/20 text-xs"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-[11px] text-slate-500">Mode</label>
                                            <select
                                                value={b.value_mode}
                                                onChange={(e) => updateBracket(i, { value_mode: e.target.value as ValueMode })}
                                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-black/20 text-xs"
                                            >
                                                <option value="PERCENT">%</option>
                                                <option value="FIXED">Rp</option>
                                            </select>
                                        </div>
                                        <div className="col-span-1">
                                            <button
                                                type="button"
                                                onClick={() => removeBracket(i)}
                                                className="text-rose-500 text-xs hover:underline"
                                            >
                                                Hapus
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={addBracket}
                                    className="text-xs text-brand-primary hover:underline"
                                >
                                    + Tambah bracket
                                </button>
                            </div>
                        )}

                        {createError && <p className="text-xs text-rose-600">{createError}</p>}
                        {createSuccess && <p className="text-xs text-emerald-600">{createSuccess}</p>}
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={isCreating}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                        >
                            {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Buat Rule
                        </button>
                    </div>
                </div>

                {/* Simulator */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-brand-primary" />
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Simulator Fee</h2>
                    </div>
                    <div className="p-5 space-y-3 text-sm">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Harga Item (IDR)</label>
                            <input
                                type="number"
                                value={simPrice}
                                onChange={(e) => setSimPrice(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Kategori</label>
                                <select
                                    value={simCategory}
                                    onChange={(e) => setSimCategory(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                >
                                    <option value="">— pilih —</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Seller Tier</label>
                                <select
                                    value={simTier}
                                    onChange={(e) => setSimTier(e.target.value as Tier)}
                                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-black/20"
                                >
                                    <option value="T0">T0</option>
                                    <option value="T1">T1</option>
                                    <option value="T2">T2</option>
                                </select>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleSimulate}
                            disabled={isSimulating}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
                        >
                            {isSimulating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Hitung
                        </button>
                        {simError && <p className="text-xs text-rose-600">{simError}</p>}
                        {simResult && (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs space-y-1">
                                <div>
                                    Fee: <strong className="text-brand-primary">Rp {simResult.fee.toLocaleString("id-ID")}</strong>
                                </div>
                                {simResult.breakdown ? (
                                    <>
                                        <div>Rule: <strong>{simResult.breakdown.ruleName}</strong> ({simResult.breakdown.mode})</div>
                                        <div className="text-slate-500">Formula: {simResult.breakdown.formula}</div>
                                    </>
                                ) : (
                                    <div className="text-slate-500">Tidak ada rule yang cocok — fee 0.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Existing rules */}
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-200 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rule Aktif & Arsip</h2>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {initialRules.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500">Belum ada rule.</div>
                    ) : (
                        initialRules.map((rule) => (
                            <div key={rule.id} className="p-5 flex items-start justify-between gap-4">
                                <div className="min-w-0 space-y-1 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <strong className="text-slate-900 dark:text-white">{rule.name}</strong>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                            {rule.mode}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                                            priority {rule.priority}
                                        </span>
                                        {!rule.is_active && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                                arsip
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Scope: {rule.scope_category_id ? `category:${rule.scope_category_id}` : "all"} ·{" "}
                                        {rule.scope_seller_tier ?? "all-tiers"}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        Default: {rule.mode === "PERCENT" ? `${rule.default_value}%` : `Rp ${rule.default_value.toLocaleString("id-ID")}`}
                                    </div>
                                    {rule.brackets.length > 0 && (
                                        <ul className="text-xs text-slate-500 space-y-0.5 pl-3 list-disc">
                                            {rule.brackets.map((b) => (
                                                <li key={b.id}>
                                                    {b.min_price.toLocaleString("id-ID")} - {b.max_price === null ? "∞" : b.max_price.toLocaleString("id-ID")} ⇒{" "}
                                                    {b.value_mode === "PERCENT" ? `${b.value}%` : `Rp ${b.value.toLocaleString("id-ID")}`}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                {rule.is_active && (
                                    <button
                                        type="button"
                                        onClick={() => handleArchive(rule.id)}
                                        className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
                                    >
                                        <Archive className="w-3 h-3" /> Arsipkan
                                    </button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
