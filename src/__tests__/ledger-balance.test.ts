/**
 * TECH-02 sample test: assert the ledger balance invariant in isolation.
 * Pure function check, no DB — gives a deterministic regression on the
 * core monetary primitive.
 *
 * Run with `npx vitest`.
 */

import { describe, it, expect } from "vitest";

interface Line {
    debit?: number;
    credit?: number;
}

function isBalanced(lines: Line[]): boolean {
    const totals = lines.reduce(
        (acc, line) => {
            acc.d += Number(line.debit ?? 0);
            acc.c += Number(line.credit ?? 0);
            return acc;
        },
        { d: 0, c: 0 }
    );
    return Math.abs(totals.d - totals.c) < 0.001;
}

describe("ledger balance", () => {
    it("requires equal debits and credits", () => {
        expect(isBalanced([{ debit: 100 }, { credit: 100 }])).toBe(true);
        expect(isBalanced([{ debit: 100 }, { credit: 99.5 }])).toBe(false);
    });

    it("allows multi-line releases (escrow → seller + platform fee)", () => {
        const lines: Line[] = [
            { credit: 1000 }, // escrow
            { debit: 950 }, // seller wallet
            { debit: 50 }, // platform revenue
        ];
        expect(isBalanced(lines)).toBe(true);
    });
});
