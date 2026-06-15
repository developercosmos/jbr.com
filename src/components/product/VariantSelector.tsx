"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Image from "next/image";

interface Variant {
    id: string;
    name: string;
    variant_type: string;
    option1_name: string | null;
    option1_value: string | null;
    option2_name: string | null;
    option2_value: string | null;
    price: string | null;
    stock: number;
    images: string[] | null;
    is_available: boolean;
}

interface VariantSelectorProps {
    variants: Variant[];
    grouped: Record<string, Variant[]>;
    basePrice: string;
    onVariantSelect?: (variant: Variant | null) => void;
}

function formatPrice(price: string) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
    }).format(parseFloat(price));
}

function uniq(values: Array<string | null>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of values) {
        const t = (v ?? "").trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push(t);
    }
    return out;
}

export function VariantSelector({ variants, grouped, basePrice, onVariantSelect }: VariantSelectorProps) {
    const isCombination = variants.some(
        (v) => v.variant_type === "combination" || v.option1_value || v.option2_value
    );
    if (variants.length === 0) return null;
    if (isCombination) {
        return <CombinationSelector variants={variants} basePrice={basePrice} onVariantSelect={onVariantSelect} />;
    }
    return <LegacySelector variants={variants} grouped={grouped} basePrice={basePrice} onVariantSelect={onVariantSelect} />;
}

// ---------------------------------------------------------------------------
// Combination mode — buyer picks one value per axis (Warna, Ukuran) which
// resolves to a single product_variants row (its price/stock drive checkout).
// ---------------------------------------------------------------------------
function CombinationSelector({
    variants,
    basePrice,
    onVariantSelect,
}: {
    variants: Variant[];
    basePrice: string;
    onVariantSelect?: (variant: Variant | null) => void;
}) {
    const axis1Name = variants.find((v) => v.option1_name)?.option1_name || "Warna";
    const axis2Name = variants.find((v) => v.option2_name)?.option2_name || "Ukuran";
    const axis1Values = uniq(variants.map((v) => v.option1_value));
    const axis2Values = uniq(variants.map((v) => v.option2_value));

    const [sel1, setSel1] = useState<string | null>(null);
    const [sel2, setSel2] = useState<string | null>(null);

    const resolve = (s1: string | null, s2: string | null): Variant | null => {
        const need1 = axis1Values.length > 0;
        const need2 = axis2Values.length > 0;
        if (need1 && !s1) return null;
        if (need2 && !s2) return null;
        return (
            variants.find(
                (v) =>
                    (v.option1_value ?? null) === (need1 ? s1 : null) &&
                    (v.option2_value ?? null) === (need2 ? s2 : null)
            ) ?? null
        );
    };

    const choose1 = (val: string) => {
        const ns = sel1 === val ? null : val;
        setSel1(ns);
        onVariantSelect?.(resolve(ns, sel2));
    };
    const choose2 = (val: string) => {
        const ns = sel2 === val ? null : val;
        setSel2(ns);
        onVariantSelect?.(resolve(sel1, ns));
    };

    const avail1 = (val: string) =>
        variants.some(
            (v) =>
                v.option1_value === val &&
                (axis2Values.length === 0 || !sel2 || v.option2_value === sel2) &&
                v.is_available &&
                v.stock > 0
        );
    const avail2 = (val: string) =>
        variants.some(
            (v) =>
                v.option2_value === val &&
                (axis1Values.length === 0 || !sel1 || v.option1_value === sel1) &&
                v.is_available &&
                v.stock > 0
        );

    const resolved = resolve(sel1, sel2);

    const renderAxis = (
        name: string,
        values: string[],
        sel: string | null,
        choose: (v: string) => void,
        avail: (v: string) => boolean,
        allowSwatch: boolean
    ) => {
        if (values.length === 0) return null;
        return (
            <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                    {name}
                    {sel && <span className="ml-1 text-slate-400 font-normal">· {sel}</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                    {values.map((val) => {
                        const isAvail = avail(val);
                        const selected = sel === val;
                        const swatch = allowSwatch
                            ? variants.find((v) => v.option1_value === val && v.images?.[0])?.images?.[0]
                            : undefined;
                        if (swatch) {
                            return (
                                <div key={val} className="flex flex-col items-center gap-1 w-12">
                                    <button
                                        type="button"
                                        onClick={() => isAvail && choose(val)}
                                        disabled={!isAvail}
                                        title={isAvail ? val : `${val} — stok habis`}
                                        aria-label={isAvail ? val : `${val}, stok habis`}
                                        className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                                            selected
                                                ? "border-brand-primary ring-2 ring-brand-primary/30"
                                                : isAvail
                                                  ? "border-slate-200 hover:border-slate-400"
                                                  : "border-slate-200 cursor-not-allowed"
                                        }`}
                                    >
                                        <Image src={swatch} alt={val} fill className={`object-cover ${isAvail ? "" : "grayscale opacity-60"}`} />
                                        {selected && isAvail && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                <Check className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                        {!isAvail && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/55">
                                                <span className="text-[9px] font-extrabold uppercase tracking-wide text-rose-600 -rotate-12">Habis</span>
                                            </div>
                                        )}
                                    </button>
                                    {!isAvail && (
                                        <span className="text-[10px] font-semibold text-rose-500 leading-none text-center">Stok habis</span>
                                    )}
                                </div>
                            );
                        }
                        return (
                            <div key={val} className="flex flex-col items-start gap-1">
                                <button
                                    type="button"
                                    onClick={() => isAvail && choose(val)}
                                    disabled={!isAvail}
                                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                        selected
                                            ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                            : isAvail
                                              ? "border-slate-200 hover:border-slate-400 text-slate-700"
                                              : "border-slate-100 text-slate-400 line-through cursor-not-allowed"
                                    }`}
                                >
                                    {val}
                                </button>
                                {!isAvail && (
                                    <span className="text-[10px] font-semibold text-rose-500 leading-none">Stok habis</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {renderAxis(axis1Name, axis1Values, sel1, choose1, avail1, true)}
            {renderAxis(axis2Name, axis2Values, sel2, choose2, avail2, false)}
            {resolved ? (
                <div className="text-sm text-slate-600 space-y-0.5">
                    {resolved.price && resolved.price !== basePrice && (
                        <p>
                            Harga: <span className="font-bold text-slate-900">{formatPrice(resolved.price)}</span>
                        </p>
                    )}
                    {resolved.is_available && resolved.stock > 0 ? (
                        <p>
                            Stok {resolved.name}: <span className="font-bold">{resolved.stock}</span>
                        </p>
                    ) : (
                        <p className="inline-flex items-center gap-1.5 font-semibold text-rose-600">
                            <span className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                            Stok {resolved.name} habis — pilih varian lain
                        </p>
                    )}
                </div>
            ) : (
                <p className="text-sm text-slate-400">Pilih kombinasi untuk melihat harga & stok.</p>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Legacy mode — single-axis variants grouped by variant_type (pre-combination).
// ---------------------------------------------------------------------------
function LegacySelector({
    variants,
    grouped,
    basePrice,
    onVariantSelect,
}: VariantSelectorProps) {
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
    const variantTypes = Object.keys(grouped);

    const handleSelect = (type: string, variantId: string) => {
        const newSelected = { ...selectedVariants, [type]: variantId };
        setSelectedVariants(newSelected);
        const variant = variants.find((v) => v.id === variantId);
        onVariantSelect?.(variant || null);
    };

    const isSelected = (type: string, variantId: string) => selectedVariants[type] === variantId;

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            size: "Ukuran",
            color: "Warna",
            grip_size: "Grip Size",
            weight: "Berat",
        };
        return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
    };

    if (variantTypes.length === 0) return null;

    return (
        <div className="space-y-4">
            {variantTypes.map((type) => (
                <div key={type}>
                    <p className="text-sm font-medium text-slate-700 mb-2">{getTypeLabel(type)}</p>
                    <div className="flex flex-wrap gap-2">
                        {grouped[type].map((variant) => {
                            const isAvailable = variant.is_available && variant.stock > 0;
                            const selected = isSelected(type, variant.id);

                            if (type === "color" && variant.images?.[0]) {
                                return (
                                    <div key={variant.id} className="flex flex-col items-center gap-1 w-12">
                                        <button
                                            onClick={() => isAvailable && handleSelect(type, variant.id)}
                                            disabled={!isAvailable}
                                            className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                                                selected
                                                    ? "border-brand-primary ring-2 ring-brand-primary/30"
                                                    : isAvailable
                                                      ? "border-slate-200 hover:border-slate-400"
                                                      : "border-slate-200 cursor-not-allowed"
                                            }`}
                                            title={isAvailable ? variant.name : `${variant.name} — stok habis`}
                                            aria-label={isAvailable ? variant.name : `${variant.name}, stok habis`}
                                        >
                                            <Image src={variant.images[0]} alt={variant.name} fill className={`object-cover ${isAvailable ? "" : "grayscale opacity-60"}`} />
                                            {selected && isAvailable && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                    <Check className="w-5 h-5 text-white" />
                                                </div>
                                            )}
                                            {!isAvailable && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/55">
                                                    <span className="text-[9px] font-extrabold uppercase tracking-wide text-rose-600 -rotate-12">Habis</span>
                                                </div>
                                            )}
                                        </button>
                                        {!isAvailable && (
                                            <span className="text-[10px] font-semibold text-rose-500 leading-none text-center">Stok habis</span>
                                        )}
                                    </div>
                                );
                            }

                            return (
                                <div key={variant.id} className="flex flex-col items-start gap-1">
                                    <button
                                        onClick={() => isAvailable && handleSelect(type, variant.id)}
                                        disabled={!isAvailable}
                                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                            selected
                                                ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                                : isAvailable
                                                  ? "border-slate-200 hover:border-slate-400 text-slate-700"
                                                  : "border-slate-100 text-slate-400 line-through cursor-not-allowed"
                                        }`}
                                    >
                                        {variant.name}
                                        {variant.price && variant.price !== basePrice && (
                                            <span className="ml-1 text-xs opacity-75">
                                                (+{formatPrice((parseFloat(variant.price) - parseFloat(basePrice)).toString())})
                                            </span>
                                        )}
                                    </button>
                                    {!isAvailable && (
                                        <span className="text-[10px] font-semibold text-rose-500 leading-none">Stok habis</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {Object.keys(selectedVariants).length > 0 && (
                <div className="text-sm text-slate-600">
                    {Object.values(selectedVariants).map((variantId) => {
                        const variant = variants.find((v) => v.id === variantId);
                        if (variant) {
                            return (
                                <p key={variantId}>
                                    Stok {variant.name}: <span className="font-bold">{variant.stock}</span>
                                </p>
                            );
                        }
                        return null;
                    })}
                </div>
            )}
        </div>
    );
}
