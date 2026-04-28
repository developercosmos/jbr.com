/**
 * Pure helpers for posting calculations. NOT a "use server" module so it can
 * export non-async values (constants, sync helpers).
 */

/** Round a number to 2 decimals using HALF_EVEN (banker's). */
export function r2(n: number): number {
    if (!Number.isFinite(n)) throw new Error(`amount not finite: ${n}`);
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const scaled = abs * 100;
    const floor = Math.floor(scaled);
    const diff = scaled - floor;
    let rounded: number;
    if (diff > 0.5) rounded = floor + 1;
    else if (diff < 0.5) rounded = floor;
    else rounded = floor % 2 === 0 ? floor : floor + 1;
    return (sign * rounded) / 100;
}

/**
 * Derive DPP & PPN from a gross fee amount.
 *
 * INCLUSIVE: gross = DPP + PPN  → DPP = gross / (1 + rate); PPN = gross - DPP
 * EXCLUSIVE: gross = DPP        → PPN added separately = gross * rate
 *
 * If isPkp=false or rate<=0 or gross<=0, returns DPP=gross, PPN=0.
 */
export function deriveFeeTax(
    grossFee: number,
    ppnRate: number,
    method: "INCLUSIVE" | "EXCLUSIVE",
    isPkp: boolean
): { dpp: number; ppn: number } {
    if (!isPkp || ppnRate <= 0 || grossFee <= 0) {
        return { dpp: r2(grossFee), ppn: 0 };
    }
    if (method === "INCLUSIVE") {
        const dpp = r2(grossFee / (1 + ppnRate));
        const ppn = r2(grossFee - dpp);
        return { dpp, ppn };
    }
    const dpp = r2(grossFee);
    const ppn = r2(grossFee * ppnRate);
    return { dpp, ppn };
}
