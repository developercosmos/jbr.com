"use server";

/**
 * GL — Period snapshot helpers (Phase 15).
 *
 * On `closePeriodAction`, we capture immutable snapshots of:
 *   - trial_balance
 *   - profit_loss
 *   - balance_sheet
 *   - cash_flow
 *
 * Stored in `accounting_period_snapshot` (one row per (period_id, report)).
 * Existing snapshots are overwritten on re-close (period reopen → close again).
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { accounting_periods, accounting_period_snapshot } from "@/db/schema-accounting";
import { eq, and } from "drizzle-orm";
import {
    getTrialBalance,
    getProfitLoss,
    getBalanceSheet,
    getCashFlow,
} from "./reports";

export type SnapshotReport = "trial_balance" | "profit_loss" | "balance_sheet" | "cash_flow";

interface PeriodLite {
    id: string;
    book: "PLATFORM" | "SELLER";
    year: number;
    month: number;
    starts_at: string | Date;
    ends_at: string | Date;
}

async function loadPeriod(periodId: string): Promise<PeriodLite> {
    const rows = await db
        .select({
            id: accounting_periods.id,
            book: accounting_periods.book,
            year: accounting_periods.year,
            month: accounting_periods.month,
            starts_at: accounting_periods.starts_at,
            ends_at: accounting_periods.ends_at,
        })
        .from(accounting_periods)
        .where(eq(accounting_periods.id, periodId))
        .limit(1);
    const r = rows[0];
    if (!r) throw new Error(`Period not found: ${periodId}`);
    return {
        id: r.id,
        book: r.book as "PLATFORM" | "SELLER",
        year: r.year,
        month: r.month,
        starts_at: r.starts_at,
        ends_at: r.ends_at,
    };
}

async function upsertSnapshot(
    periodId: string,
    report: SnapshotReport,
    payload: unknown,
    totals: Record<string, number> | null,
    capturedBy: string | null
): Promise<void> {
    await db.execute(sql`
        INSERT INTO accounting_period_snapshot (period_id, report, payload, totals, captured_by)
        VALUES (${periodId}, ${report}, ${JSON.stringify(payload)}::jsonb,
                ${totals ? JSON.stringify(totals) : null}::jsonb, ${capturedBy})
        ON CONFLICT (period_id, report)
        DO UPDATE SET payload = EXCLUDED.payload, totals = EXCLUDED.totals,
                      captured_at = now(), captured_by = EXCLUDED.captured_by
    `);
}

/**
 * Capture all four reports for the given period and persist them.
 * Best-effort per report — one failure does not abort the others.
 */
export async function capturePeriodSnapshots(
    periodId: string,
    capturedBy: string | null = null
): Promise<{ captured: SnapshotReport[]; errors: Record<string, string> }> {
    const period = await loadPeriod(periodId);
    const from = new Date(typeof period.starts_at === "string" ? period.starts_at : period.starts_at.toISOString());
    const to = new Date(`${typeof period.ends_at === "string" ? period.ends_at : period.ends_at.toISOString().slice(0, 10)}T23:59:59`);
    const book = period.book;

    const captured: SnapshotReport[] = [];
    const errors: Record<string, string> = {};

    try {
        const tb = await getTrialBalance({ from, to, book });
        await upsertSnapshot(periodId, "trial_balance", tb, {
            totalDebit: tb.totalDebit,
            totalCredit: tb.totalCredit,
            balanced: tb.balanced ? 1 : 0,
        }, capturedBy);
        captured.push("trial_balance");
    } catch (e) {
        errors.trial_balance = e instanceof Error ? e.message : String(e);
    }

    try {
        const pl = await getProfitLoss({ from, to, book });
        await upsertSnapshot(periodId, "profit_loss", pl, {
            netProfit: pl.netProfit,
            grossProfit: pl.grossProfit,
            operatingProfit: pl.operatingProfit,
        }, capturedBy);
        captured.push("profit_loss");
    } catch (e) {
        errors.profit_loss = e instanceof Error ? e.message : String(e);
    }

    try {
        const bs = await getBalanceSheet({ asOf: to, book });
        await upsertSnapshot(periodId, "balance_sheet", bs, {
            totalAssets: bs.assets.subtotal,
            totalLiabEq: bs.totalLiabilitiesAndEquity,
            balanced: bs.balanced ? 1 : 0,
        }, capturedBy);
        captured.push("balance_sheet");
    } catch (e) {
        errors.balance_sheet = e instanceof Error ? e.message : String(e);
    }

    try {
        const cf = await getCashFlow({ from, to, book });
        await upsertSnapshot(periodId, "cash_flow", cf, {
            netCashChange: cf.netCashChange,
            openingCash: cf.openingCash,
            closingCash: cf.closingCash,
        }, capturedBy);
        captured.push("cash_flow");
    } catch (e) {
        errors.cash_flow = e instanceof Error ? e.message : String(e);
    }

    return { captured, errors };
}

export interface PeriodSnapshotEntry {
    id: string;
    periodId: string;
    report: SnapshotReport;
    payload: unknown;
    totals: Record<string, number> | null;
    capturedAt: string;
    capturedBy: string | null;
}

export async function listPeriodSnapshots(periodId: string): Promise<PeriodSnapshotEntry[]> {
    const rows = await db
        .select({
            id: accounting_period_snapshot.id,
            periodId: accounting_period_snapshot.period_id,
            report: accounting_period_snapshot.report,
            payload: accounting_period_snapshot.payload,
            totals: accounting_period_snapshot.totals,
            capturedAt: accounting_period_snapshot.captured_at,
            capturedBy: accounting_period_snapshot.captured_by,
        })
        .from(accounting_period_snapshot)
        .where(eq(accounting_period_snapshot.period_id, periodId));
    return rows.map((r) => ({
        id: r.id,
        periodId: r.periodId,
        report: r.report as SnapshotReport,
        payload: r.payload,
        totals: (r.totals ?? null) as Record<string, number> | null,
        capturedAt: r.capturedAt.toISOString(),
        capturedBy: r.capturedBy ?? null,
    }));
}

export async function getPeriodSnapshot(
    periodId: string,
    report: SnapshotReport
): Promise<PeriodSnapshotEntry | null> {
    const rows = await db
        .select({
            id: accounting_period_snapshot.id,
            periodId: accounting_period_snapshot.period_id,
            report: accounting_period_snapshot.report,
            payload: accounting_period_snapshot.payload,
            totals: accounting_period_snapshot.totals,
            capturedAt: accounting_period_snapshot.captured_at,
            capturedBy: accounting_period_snapshot.captured_by,
        })
        .from(accounting_period_snapshot)
        .where(
            and(
                eq(accounting_period_snapshot.period_id, periodId),
                eq(accounting_period_snapshot.report, report)
            )
        )
        .limit(1);
    const r = rows[0];
    if (!r) return null;
    return {
        id: r.id,
        periodId: r.periodId,
        report: r.report as SnapshotReport,
        payload: r.payload,
        totals: (r.totals ?? null) as Record<string, number> | null,
        capturedAt: r.capturedAt.toISOString(),
        capturedBy: r.capturedBy ?? null,
    };
}
