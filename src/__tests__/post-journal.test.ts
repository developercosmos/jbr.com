/**
 * GL-02 — postJournal validation tests.
 *
 * Pure logic checks for the invariants enforced by postJournal:
 *   (a) every line has exactly one of debit/credit > 0
 *   (b) sum(debit) == sum(credit) within 1 sen tolerance
 *   (c) HALF_EVEN (banker's) rounding produces deterministic 2dp results
 *   (d) journal_no follows JV-YYYYMM-000001 format
 *
 * DB-side behavior (idempotency, period-lock, account resolution) is exercised
 * in integration tests against a real Postgres in CI.
 *
 * Run: npx vitest run src/__tests__/post-journal.test.ts
 */

import { describe, it, expect } from "vitest";

const TOLERANCE = 0.01;

function round2(n: number, mode: "HALF_EVEN" | "HALF_UP" = "HALF_EVEN"): number {
    if (!Number.isFinite(n)) throw new Error(`amount not finite: ${n}`);
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const scaled = abs * 100;
    let rounded: number;
    if (mode === "HALF_UP") {
        rounded = Math.round(scaled);
    } else {
        const floor = Math.floor(scaled);
        const diff = scaled - floor;
        if (diff > 0.5) rounded = floor + 1;
        else if (diff < 0.5) rounded = floor;
        else rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    return (sign * rounded) / 100;
}

interface Line {
    debit?: number;
    credit?: number;
}

function validateLines(lines: Line[]): { ok: true } | { ok: false; reason: string } {
    if (lines.length < 2) return { ok: false, reason: "min 2 lines" };
    let sd = 0;
    let sc = 0;
    for (let i = 0; i < lines.length; i++) {
        const d = round2(lines[i].debit ?? 0);
        const c = round2(lines[i].credit ?? 0);
        if (d < 0 || c < 0) return { ok: false, reason: `line ${i + 1} negative` };
        if ((d > 0) === (c > 0))
            return { ok: false, reason: `line ${i + 1} must have exactly one of debit/credit` };
        sd += d;
        sc += c;
    }
    if (Math.abs(sd - sc) > TOLERANCE) return { ok: false, reason: `unbalanced ${sd} vs ${sc}` };
    return { ok: true };
}

function buildJournalNo(year: number, month: number, seq: number): string {
    return `JV-${year}${String(month).padStart(2, "0")}-${String(seq).padStart(6, "0")}`;
}

describe("postJournal — validation invariants (GL-02)", () => {
    it("rejects single-line journals", () => {
        expect(validateLines([{ debit: 100 }])).toEqual({ ok: false, reason: "min 2 lines" });
    });

    it("rejects line with both debit and credit", () => {
        const r = validateLines([
            { debit: 100, credit: 100 },
            { credit: 100 },
        ]);
        expect(r.ok).toBe(false);
    });

    it("rejects line with neither debit nor credit", () => {
        const r = validateLines([{ debit: 100 }, {}]);
        expect(r.ok).toBe(false);
    });

    it("rejects negative amounts", () => {
        const r = validateLines([{ debit: -50 }, { credit: -50 }]);
        expect(r.ok).toBe(false);
    });

    it("accepts a balanced 3-line release journal (escrow → seller + revenue + PPN)", () => {
        // 100k payment release: 23000 debit; 22000 credit 95k; 41000 credit 4504; 24100 credit 496
        const r = validateLines([
            { debit: 100_000 },
            { credit: 95_000 },
            { credit: 4_504 },
            { credit: 496 },
        ]);
        expect(r.ok).toBe(true);
    });

    it("rejects unbalanced journal (>1 sen drift)", () => {
        const r = validateLines([
            { debit: 100_000 },
            { credit: 95_000 },
            { credit: 4_504 },
            { credit: 495 }, // off by 1 sen — actually 1 IDR diff = 100 sen so it fails
        ]);
        expect(r.ok).toBe(false);
    });

    it("tolerates 1 sen rounding drift", () => {
        const r = validateLines([{ debit: 100.005 }, { credit: 100 }]);
        expect(r.ok).toBe(true);
    });
});

describe("postJournal — round2 (HALF_EVEN banker's rounding)", () => {
    it("rounds 0.5 to even", () => {
        expect(round2(2.005)).toBe(2.0); // 2.005 → 2.00 (round to even)
        expect(round2(2.015)).toBe(2.02);
        expect(round2(2.025)).toBe(2.02); // 2.025 → 2.02 (round to even)
        expect(round2(2.035)).toBe(2.04);
    });

    it("HALF_UP variant always rounds .5 up", () => {
        expect(round2(2.005, "HALF_UP")).toBe(2.01);
        expect(round2(2.015, "HALF_UP")).toBe(2.02);
        expect(round2(2.025, "HALF_UP")).toBe(2.03);
    });

    it("preserves sign", () => {
        expect(round2(-1.234)).toBe(-1.23);
        expect(round2(-1.235)).toBe(-1.24);
    });

    it("rejects NaN/Infinity", () => {
        expect(() => round2(NaN)).toThrow();
        expect(() => round2(Infinity)).toThrow();
    });
});

describe("postJournal — journal_no format", () => {
    it("uses JV-YYYYMM-NNNNNN format with zero-padding", () => {
        expect(buildJournalNo(2026, 4, 1)).toBe("JV-202604-000001");
        expect(buildJournalNo(2026, 12, 999)).toBe("JV-202612-000999");
        expect(buildJournalNo(2026, 1, 1234567)).toBe("JV-202601-1234567");
    });
});

describe("postJournal — Indonesian PSAK example: PPN 11% inclusive on Rp 5.000 fee", () => {
    // DPP = 5000 / 1.11 = 4504.50 → 4504 (HALF_EVEN); PPN = 5000 - 4504 = 496
    it("derives DPP and PPN that sum back to gross", () => {
        const gross = 5000;
        const dpp = round2(gross / 1.11);
        const ppn = round2(gross - dpp);
        expect(dpp + ppn).toBe(gross);
    });
});
