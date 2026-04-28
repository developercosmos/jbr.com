import { describe, it, expect } from "vitest";
import { r2, deriveFeeTax } from "../actions/accounting/posting-internal";

describe("posting.deriveFeeTax", () => {
    it("returns gross as DPP and 0 PPN when entity is non-PKP", () => {
        const r = deriveFeeTax(10000, 0.11, "INCLUSIVE", false);
        expect(r.dpp).toBe(10000);
        expect(r.ppn).toBe(0);
    });

    it("returns 0/0 when grossFee is 0", () => {
        const r = deriveFeeTax(0, 0.11, "INCLUSIVE", true);
        expect(r.dpp).toBe(0);
        expect(r.ppn).toBe(0);
    });

    it("INCLUSIVE 11% on 5000 gross splits to DPP 4504.50 + PPN 495.50", () => {
        const r = deriveFeeTax(5000, 0.11, "INCLUSIVE", true);
        // 5000 / 1.11 = 4504.5045045  → 4504.50 (banker's)
        expect(r.dpp).toBe(4504.5);
        expect(r.ppn).toBe(495.5);
        expect(r2(r.dpp + r.ppn)).toBe(5000);
    });

    it("INCLUSIVE 11% on 11100 gross splits to DPP 10000 + PPN 1100 exactly", () => {
        const r = deriveFeeTax(11100, 0.11, "INCLUSIVE", true);
        expect(r.dpp).toBe(10000);
        expect(r.ppn).toBe(1100);
    });

    it("EXCLUSIVE 11% on 10000 → DPP 10000 + PPN 1100", () => {
        const r = deriveFeeTax(10000, 0.11, "EXCLUSIVE", true);
        expect(r.dpp).toBe(10000);
        expect(r.ppn).toBe(1100);
    });

    it("INCLUSIVE 0% rate behaves like non-PKP (DPP=gross, PPN=0)", () => {
        const r = deriveFeeTax(7777, 0, "INCLUSIVE", true);
        expect(r.dpp).toBe(7777);
        expect(r.ppn).toBe(0);
    });
});

describe("posting.r2 (banker's rounding sanity)", () => {
    it("rounds 0.005 to 0.00 (HALF_EVEN)", () => {
        expect(r2(0.005)).toBe(0);
    });
    it("rounds 0.015 to 0.02 (HALF_EVEN)", () => {
        expect(r2(0.015)).toBe(0.02);
    });
    it("rejects NaN", () => {
        expect(() => r2(NaN)).toThrow();
    });
});
