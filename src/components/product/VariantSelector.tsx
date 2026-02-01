"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Image from "next/image";

interface Variant {
    id: string;
    name: string;
    variant_type: string;
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

export function VariantSelector({
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

        // Find the selected variant
        const variant = variants.find((v) => v.id === variantId);
        onVariantSelect?.(variant || null);
    };

    const isSelected = (type: string, variantId: string) => {
        return selectedVariants[type] === variantId;
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(parseFloat(price));
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            size: "Ukuran",
            color: "Warna",
            grip_size: "Grip Size",
            weight: "Berat",
        };
        return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
    };

    if (variantTypes.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {variantTypes.map((type) => (
                <div key={type}>
                    <p className="text-sm font-medium text-slate-700 mb-2">
                        {getTypeLabel(type)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {grouped[type].map((variant) => {
                            const isAvailable = variant.is_available && variant.stock > 0;
                            const selected = isSelected(type, variant.id);

                            // Color variant with image swatch
                            if (type === "color" && variant.images?.[0]) {
                                return (
                                    <button
                                        key={variant.id}
                                        onClick={() => isAvailable && handleSelect(type, variant.id)}
                                        disabled={!isAvailable}
                                        className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${selected
                                                ? "border-brand-primary ring-2 ring-brand-primary/30"
                                                : isAvailable
                                                    ? "border-slate-200 hover:border-slate-400"
                                                    : "border-slate-100 opacity-50 cursor-not-allowed"
                                            }`}
                                        title={variant.name}
                                    >
                                        <Image
                                            src={variant.images[0]}
                                            alt={variant.name}
                                            fill
                                            className="object-cover"
                                        />
                                        {selected && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                <Check className="w-5 h-5 text-white" />
                                            </div>
                                        )}
                                        {!isAvailable && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                                                <span className="text-xs text-slate-500">Habis</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            }

                            // Standard text button
                            return (
                                <button
                                    key={variant.id}
                                    onClick={() => isAvailable && handleSelect(type, variant.id)}
                                    disabled={!isAvailable}
                                    className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${selected
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
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Stock Info */}
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
