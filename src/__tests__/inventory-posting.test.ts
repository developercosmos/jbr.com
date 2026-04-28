import { describe, it, expect } from "vitest";
import { simulateMovingAverage } from "@/actions/accounting/inventory-internal";

describe("Inventory — moving-average cost (Phase 8)", () => {
    it("single receipt", () => {
        const s = simulateMovingAverage([{ qty: 10, unitCost: 100 }]);
        expect(s.qtyOnHand).toBe(10);
        expect(s.valueOnHand).toBe(1000);
        expect(s.avg).toBe(100);
    });

    it("two receipts at different prices → weighted average", () => {
        const s = simulateMovingAverage([
            { qty: 10, unitCost: 100 },   // value 1000
            { qty: 10, unitCost: 200 },   // value 2000 → total 3000 / 20 = 150
        ]);
        expect(s.qtyOnHand).toBe(20);
        expect(s.valueOnHand).toBe(3000);
        expect(s.avg).toBe(150);
    });

    it("issue uses current avg (does not change avg)", () => {
        const s = simulateMovingAverage([
            { qty: 10, unitCost: 100 },
            { qty: 10, unitCost: 200 },
            { qty: -5, unitCost: 0 },     // sign-only; cost taken from avg
        ]);
        expect(s.qtyOnHand).toBe(15);
        expect(s.valueOnHand).toBe(2250); // 15 * 150
        expect(s.avg).toBe(150);
    });

    it("issue then new receipt re-weights average", () => {
        const s = simulateMovingAverage([
            { qty: 10, unitCost: 100 },   // avg 100
            { qty: -5, unitCost: 0 },     // qty 5 value 500
            { qty: 5, unitCost: 300 },    // qty 10 value 500+1500=2000 → avg 200
        ]);
        expect(s.qtyOnHand).toBe(10);
        expect(s.valueOnHand).toBe(2000);
        expect(s.avg).toBe(200);
    });

    it("over-issue clamps to zero (defensive; runtime should reject before)", () => {
        const s = simulateMovingAverage([
            { qty: 5, unitCost: 100 },
            { qty: -10, unitCost: 0 },
        ]);
        expect(s.qtyOnHand).toBe(0);
        expect(s.valueOnHand).toBe(0);
    });

    it("zero stock starting issue is a no-op (avg = 0)", () => {
        const s = simulateMovingAverage([{ qty: -5, unitCost: 0 }]);
        expect(s.qtyOnHand).toBe(0);
        expect(s.valueOnHand).toBe(0);
        expect(s.avg).toBe(0);
    });

    it("PSAK example: receipt 100@5000 + 200@5500, issue 150 → COGS at 5333.33", () => {
        const s = simulateMovingAverage([
            { qty: 100, unitCost: 5000 },   // value 500_000
            { qty: 200, unitCost: 5500 },   // value 1_100_000 → total 1_600_000 / 300 = 5333.3333
            { qty: -150, unitCost: 0 },
        ]);
        expect(s.qtyOnHand).toBe(150);
        // COGS for 150 = 150 * 5333.3333 ≈ 800_000
        // remaining value ≈ 800_000 (rounded to 2dp)
        expect(s.valueOnHand).toBeCloseTo(800_000, 0);
        expect(s.avg).toBeCloseTo(5333.3333, 2);
    });
});
