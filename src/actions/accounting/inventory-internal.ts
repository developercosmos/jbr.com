/**
 * Pure inventory cost-math helpers (no "use server" — safe to import from
 * tests and from inside server-action files).
 */

export interface MovingAvgState {
    qtyOnHand: number;
    valueOnHand: number;
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}
function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}

export function round2Cost(n: number): number {
    return round2(n);
}
export function round4Cost(n: number): number {
    return round4(n);
}

/** Pure simulation of moving-average update for a sequence of movements.
 *  Positive qty = receipt/return-in/adjust+. Negative qty = issue/return-out/adjust-.
 *  Issues use the running average cost (caller's unitCost is ignored when qty < 0). */
export function simulateMovingAverage(
    movements: Array<{ qty: number; unitCost: number }>
): MovingAvgState & { avg: number } {
    let qty = 0;
    let value = 0;
    for (const m of movements) {
        if (m.qty > 0) {
            qty += m.qty;
            value += m.qty * m.unitCost;
        } else if (m.qty < 0) {
            const avg = qty > 0 ? value / qty : 0;
            qty += m.qty;
            value += m.qty * avg;
            if (qty < 0) qty = 0;
            if (value < 0) value = 0;
        }
    }
    return {
        qtyOnHand: round4(qty),
        valueOnHand: round2(value),
        avg: qty > 0 ? round4(value / qty) : 0,
    };
}
