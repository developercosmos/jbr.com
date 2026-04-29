import { describe, expect, it } from "vitest";
import { computeAutoCounterAmount, shouldTriggerAutoCounter } from "@/lib/offer-auto-counter";

describe("offer auto-counter helpers", () => {
    it("triggers only when offer is below floor", () => {
        expect(shouldTriggerAutoCounter({ offerAmount: 750000, floorPrice: 800000 })).toBe(true);
        expect(shouldTriggerAutoCounter({ offerAmount: 800000, floorPrice: 800000 })).toBe(false);
        expect(shouldTriggerAutoCounter({ offerAmount: 850000, floorPrice: 800000 })).toBe(false);
    });

    it("does not trigger when floor is missing or invalid", () => {
        expect(shouldTriggerAutoCounter({ offerAmount: 750000, floorPrice: null })).toBe(false);
        expect(shouldTriggerAutoCounter({ offerAmount: 750000, floorPrice: 0 })).toBe(false);
    });

    it("computes midpoint and rounds to integer", () => {
        expect(computeAutoCounterAmount({ offerAmount: 700000, floorPrice: 900000 })).toBe(800000);
        expect(computeAutoCounterAmount({ offerAmount: 700001, floorPrice: 900000 })).toBe(800001);
    });
});
