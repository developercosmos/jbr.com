"use client";

import { forwardRef } from "react";

type CurrencyInputProps = Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
> & {
    /** Raw amount as a numeric string, e.g. "2100000" (or "" when empty). */
    value: string;
    /** Receives the raw digit string with separators stripped. */
    onValueChange: (raw: string) => void;
};

/** Group an amount with id-ID thousand separators ("2.100.000"). Tolerant of
 *  decimal strings coming from the DB (e.g. "2250000.00") on first render. */
function grouped(value: string): string {
    if (!value) return "";
    const n = Number(value);
    if (!Number.isNaN(n)) return Math.round(n).toLocaleString("id-ID");
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits).toLocaleString("id-ID") : "";
}

/**
 * Text input that displays an IDR amount with thousand separators while keeping
 * the parent state as a raw digit string. Native number inputs can't render
 * separators; this also drops the spinner + mouse-wheel footgun and surfaces the
 * numeric keypad on mobile (inputMode).
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
    function CurrencyInput({ value, onValueChange, inputMode = "numeric", ...rest }, ref) {
        return (
            <input
                {...rest}
                ref={ref}
                type="text"
                inputMode={inputMode}
                value={grouped(value)}
                onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ""))}
            />
        );
    }
);
