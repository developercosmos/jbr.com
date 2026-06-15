"use client";

import { useEffect, useRef, useState } from "react";
import { X, Plus, Loader2, ImagePlus } from "lucide-react";

// One generated combination row, as held in the seller form state.
export interface ComboVariant {
    name: string; // combined label, e.g. "Merah / M"
    option1_name: string | null;
    option1_value: string | null;
    option2_name: string | null;
    option2_value: string | null;
    price: string; // form string ("" = pakai harga produk)
    stock: string; // form string
    images: string[]; // variant image(s); tied to the Warna value
}

const AXIS1 = "Warna";
const AXIS2 = "Ukuran";

function cellKey(c1: string | null, c2: string | null): string {
    return `${c1 ?? ""}|||${c2 ?? ""}`;
}

function comboLabel(c1: string | null, c2: string | null): string {
    return [c1, c2].filter(Boolean).join(" / ");
}

function uniqueOrdered(values: Array<string | null | undefined>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
        const t = (v ?? "").trim();
        if (!t) continue;
        const k = t.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(t);
    }
    return out;
}

interface InitState {
    colors: string[];
    sizes: string[];
    cells: Record<string, { price: string; stock: string }>;
    colorImages: Record<string, string>;
}

function deriveInitial(value: ComboVariant[]): InitState {
    const hasOptionData = value.some((v) => v.option1_value || v.option2_value);
    const cells: Record<string, { price: string; stock: string }> = {};
    const colorImages: Record<string, string> = {};

    if (hasOptionData) {
        const colors = uniqueOrdered(value.map((v) => v.option1_value));
        const sizes = uniqueOrdered(value.map((v) => v.option2_value));
        for (const v of value) {
            cells[cellKey(v.option1_value || null, v.option2_value || null)] = {
                price: v.price ?? "",
                stock: v.stock ?? "1",
            };
            if (v.option1_value && v.images?.[0]) colorImages[v.option1_value] = v.images[0];
        }
        return { colors, sizes, cells, colorImages };
    }

    // Legacy / flat variants (name only): load each as a single "Warna" value.
    if (value.length > 0) {
        const colors = uniqueOrdered(value.map((v) => v.name));
        for (const v of value) {
            cells[cellKey(v.name || null, null)] = { price: v.price ?? "", stock: v.stock ?? "1" };
            if (v.name && v.images?.[0]) colorImages[v.name] = v.images[0];
        }
        return { colors, sizes: [], cells, colorImages };
    }

    return { colors: [], sizes: [], cells: {}, colorImages: {} };
}

export default function VariantMatrixEditor({
    value,
    onChange,
    basePrice,
}: {
    value: ComboVariant[];
    onChange: (combos: ComboVariant[]) => void;
    basePrice?: string;
}) {
    const initial = useRef<InitState>(deriveInitial(value));
    const [colors, setColors] = useState<string[]>(initial.current.colors);
    const [sizes, setSizes] = useState<string[]>(initial.current.sizes);
    const [cells, setCells] = useState<Record<string, { price: string; stock: string }>>(
        initial.current.cells
    );
    const [colorInput, setColorInput] = useState("");
    const [sizeInput, setSizeInput] = useState("");
    const [bulkPrice, setBulkPrice] = useState("");
    const [bulkStock, setBulkStock] = useState("");
    const [colorImages, setColorImages] = useState<Record<string, string>>(initial.current.colorImages);
    const [uploadingColor, setUploadingColor] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    // Build the combination list from the current axes.
    const c1list: Array<string | null> = colors.length ? colors : [null];
    const c2list: Array<string | null> = sizes.length ? sizes : [null];
    const combos: Array<{ c1: string | null; c2: string | null }> = [];
    for (const c1 of c1list) {
        for (const c2 of c2list) {
            if (c1 === null && c2 === null) continue;
            combos.push({ c1, c2 });
        }
    }

    // Emit normalized combos to the parent whenever axes or cells change.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        const out: ComboVariant[] = combos.map(({ c1, c2 }) => {
            const k = cellKey(c1, c2);
            const cell = cells[k] ?? { price: "", stock: "1" };
            return {
                name: comboLabel(c1, c2),
                option1_name: colors.length ? AXIS1 : null,
                option1_value: c1,
                option2_name: sizes.length ? AXIS2 : null,
                option2_value: c2,
                price: cell.price,
                stock: cell.stock,
                images: c1 && colorImages[c1] ? [colorImages[c1]] : [],
            };
        });
        onChangeRef.current(out);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [colors, sizes, cells, colorImages]);

    function addValue(axis: "color" | "size") {
        const raw = (axis === "color" ? colorInput : sizeInput).trim();
        if (!raw) return;
        // allow comma-separated bulk add
        const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
        if (axis === "color") {
            setColors((prev) => uniqueOrdered([...prev, ...parts]));
            setColorInput("");
        } else {
            setSizes((prev) => uniqueOrdered([...prev, ...parts]));
            setSizeInput("");
        }
    }

    function removeValue(axis: "color" | "size", val: string) {
        if (axis === "color") setColors((prev) => prev.filter((v) => v !== val));
        else setSizes((prev) => prev.filter((v) => v !== val));
    }

    async function uploadColorImage(color: string, file: File) {
        setUploadError(null);
        setUploadingColor(color);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("folder", "products");
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (!res.ok) {
                let msg = "Upload gagal";
                try {
                    const d = await res.json();
                    msg = d.error || msg;
                } catch {
                    /* non-JSON error body */
                }
                throw new Error(res.status === 429 ? "Terlalu banyak request. Coba lagi sebentar." : msg);
            }
            const data = await res.json();
            setColorImages((prev) => ({ ...prev, [color]: data.url as string }));
        } catch (e) {
            setUploadError(e instanceof Error ? e.message : "Upload gagal");
        } finally {
            setUploadingColor(null);
        }
    }

    function removeColorImage(color: string) {
        setColorImages((prev) => {
            const next = { ...prev };
            delete next[color];
            return next;
        });
    }

    function updateCell(c1: string | null, c2: string | null, patch: Partial<{ price: string; stock: string }>) {
        const k = cellKey(c1, c2);
        setCells((prev) => {
            const cur = prev[k] ?? { price: "", stock: "1" };
            return { ...prev, [k]: { ...cur, ...patch } };
        });
    }

    function applyBulk() {
        if (bulkPrice === "" && bulkStock === "") return;
        setCells(() => {
            const next: Record<string, { price: string; stock: string }> = {};
            for (const { c1, c2 } of combos) {
                const k = cellKey(c1, c2);
                const cur = cells[k] ?? { price: "", stock: "1" };
                next[k] = {
                    price: bulkPrice !== "" ? bulkPrice : cur.price,
                    stock: bulkStock !== "" ? bulkStock : cur.stock,
                };
            }
            return next;
        });
    }

    const chipInput = (axis: "color" | "size", label: string, hint: string, values: string[], input: string, setInput: (s: string) => void) => (
        <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{label}</label>
            <p className="text-xs text-slate-400 mb-2">{hint}</p>
            <div className="flex flex-wrap gap-2 mb-2">
                {values.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 text-brand-primary px-2.5 py-1 text-xs font-medium">
                        {v}
                        <button type="button" onClick={() => removeValue(axis, v)} className="hover:text-rose-600" aria-label={`Hapus ${v}`}>
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addValue(axis);
                        }
                    }}
                    placeholder={axis === "color" ? "mis. Merah" : "mis. M"}
                    className="flex-1 rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white py-2 px-3 text-sm"
                />
                <button type="button" onClick={() => addValue(axis)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">
                    <Plus className="w-4 h-4" /> Tambah
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chipInput("color", "Warna", "Tambahkan pilihan warna (opsional).", colors, colorInput, setColorInput)}
                {chipInput("size", "Ukuran", "Tambahkan pilihan ukuran (opsional).", sizes, sizeInput, setSizeInput)}
            </div>

            {colors.length > 0 && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Gambar per Warna (opsional)</label>
                    <p className="text-xs text-slate-400 mb-2">Satu foto untuk tiap warna — tampil sebagai swatch &amp; di galeri halaman produk.</p>
                    {uploadError && <p className="text-xs text-rose-600 mb-2">{uploadError}</p>}
                    <div className="flex flex-wrap gap-3">
                        {colors.map((color) => {
                            const img = colorImages[color];
                            return (
                                <div key={color} className="flex w-20 flex-col items-center gap-1">
                                    <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 hover:border-brand-primary dark:border-slate-700 dark:bg-black/20">
                                        {img ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={img} alt={color} className="h-full w-full object-cover" />
                                        ) : uploadingColor === color ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                        ) : (
                                            <ImagePlus className="h-5 w-5 text-slate-400" />
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) uploadColorImage(color, f);
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                    <span className="w-full truncate text-center text-[11px] text-slate-600 dark:text-slate-300">{color}</span>
                                    {img && (
                                        <button type="button" onClick={() => removeColorImage(color)} className="text-[11px] text-rose-600 hover:underline">
                                            Hapus
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {combos.length === 0 ? (
                <p className="text-sm text-slate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center">
                    Tambahkan nilai Warna dan/atau Ukuran untuk membuat kombinasi.
                </p>
            ) : (
                <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 dark:bg-black/20 p-3">
                        <span className="text-xs font-medium text-slate-500">Isi cepat semua ({combos.length} kombinasi):</span>
                        <input type="number" min={0} onWheel={(e) => e.currentTarget.blur()} value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} placeholder="Harga" className="w-28 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-slate-700 py-1.5 px-2 text-sm" />
                        <input type="number" min={0} onWheel={(e) => e.currentTarget.blur()} value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder="Stok" className="w-20 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-slate-700 py-1.5 px-2 text-sm" />
                        <button type="button" onClick={applyBulk} className="rounded-lg bg-slate-800 dark:bg-slate-700 text-white px-3 py-1.5 text-sm font-medium">Terapkan</button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 dark:bg-black/20 text-xs uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th className="px-3 py-2 text-left">Kombinasi</th>
                                    <th className="px-3 py-2 text-left w-40">Harga (kosong = harga produk)</th>
                                    <th className="px-3 py-2 text-left w-28">Stok</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {combos.map(({ c1, c2 }) => {
                                    const k = cellKey(c1, c2);
                                    const cell = cells[k] ?? { price: "", stock: "1" };
                                    return (
                                        <tr key={k}>
                                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{comboLabel(c1, c2)}</td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                    value={cell.price}
                                                    onChange={(e) => updateCell(c1, c2, { price: e.target.value })}
                                                    placeholder={basePrice || "harga produk"}
                                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 py-1.5 px-2 text-sm"
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    onWheel={(e) => e.currentTarget.blur()}
                                                    value={cell.stock}
                                                    onChange={(e) => updateCell(c1, c2, { stock: e.target.value })}
                                                    className="w-full rounded-lg bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 py-1.5 px-2 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="text-xs text-slate-400">
                        Total stok (jumlah semua kombinasi) menjadi inventaris yang dijual. Pembeli wajib memilih kombinasi sebelum checkout.
                    </p>
                </div>
            )}
        </div>
    );
}
