import { AlertTriangle } from "lucide-react";

interface LowStockBadgeProps {
    stock: number;
    threshold?: number;
}

/** Pill badge for the PDP / detail surfaces. Renders nothing above threshold. */
export function LowStockBadge({ stock, threshold = 5 }: LowStockBadgeProps) {
    if (stock > threshold) return null;

    if (stock <= 0) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full dark:bg-red-900/30 dark:text-red-300">
                <AlertTriangle className="w-3 h-3" />
                Stok Habis
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full dark:bg-amber-900/30 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            Sisa {stock} unit
        </span>
    );
}

interface LowStockTextProps {
    stock: number;
    threshold?: number;
}

/** Compact text version for product cards. */
export function LowStockText({ stock, threshold = 5 }: LowStockTextProps) {
    if (stock > threshold) return null;
    if (stock <= 0) return <span className="text-red-600 text-xs font-bold">Stok habis</span>;
    return <span className="text-amber-600 text-xs font-bold">Sisa {stock}</span>;
}
