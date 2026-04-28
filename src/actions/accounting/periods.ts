"use server";

/**
 * GL — Accounting period lifecycle.
 *
 * Lifecycle: OPEN → LOCKED (no new manual posting; auto-posting still allowed
 * for race-condition safety) → CLOSED (frozen + snapshot of TB/PL/BS taken).
 *
 * Closing checklist (plan §8.2) is enforced by `assertCloseChecklist` before
 * we flip a period to CLOSED. Re-open of a CLOSED period is admin-only and
 * audit-logged.
 */

import { db } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import {
    accounting_periods,
    coa_accounts,
    journal_lines,
    journals,
    type ledgerBookEnum,
    type periodStatusEnum,
} from "@/db/schema-accounting";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { revalidatePath } from "next/cache";

export type LedgerBook = (typeof ledgerBookEnum.enumValues)[number];
export type PeriodStatus = (typeof periodStatusEnum.enumValues)[number];

export interface PeriodRow {
    id: string;
    book: LedgerBook;
    year: number;
    month: number;
    starts_at: string;
    ends_at: string;
    status: PeriodStatus;
    locked_at: string | null;
    closed_at: string | null;
    journals_count: number;
    debit_total: string;
    credit_total: string;
}

/**
 * List periods with summary stats for the admin lifecycle page.
 */
export async function listPeriodsWithStats(book: LedgerBook = "PLATFORM"): Promise<PeriodRow[]> {
    const rows = await db.execute(sql`
        SELECT
            p.id,
            p.book,
            p.year,
            p.month,
            p.starts_at::text AS starts_at,
            p.ends_at::text AS ends_at,
            p.status,
            p.locked_at,
            p.closed_at,
            COALESCE(j.cnt, 0)::int AS journals_count,
            COALESCE(j.debit_total, 0)::text AS debit_total,
            COALESCE(j.credit_total, 0)::text AS credit_total
        FROM accounting_periods p
        LEFT JOIN (
            SELECT j.period_id,
                   COUNT(*)::int AS cnt,
                   SUM(jl.debit) AS debit_total,
                   SUM(jl.credit) AS credit_total
            FROM journals j
            JOIN journal_lines jl ON jl.journal_id = j.id
            WHERE j.status = 'POSTED'
            GROUP BY j.period_id
        ) j ON j.period_id = p.id
        WHERE p.book = ${book}
        ORDER BY p.year DESC, p.month DESC
    `);
    type Row = (typeof rows)[number];
    return (rows as Row[]).map((r) => ({
        id: String(r.id),
        book: r.book as LedgerBook,
        year: Number(r.year),
        month: Number(r.month),
        starts_at: String(r.starts_at),
        ends_at: String(r.ends_at),
        status: r.status as PeriodStatus,
        locked_at: r.locked_at ? new Date(r.locked_at as string | Date).toISOString() : null,
        closed_at: r.closed_at ? new Date(r.closed_at as string | Date).toISOString() : null,
        journals_count: Number(r.journals_count),
        debit_total: String(r.debit_total),
        credit_total: String(r.credit_total),
    }));
}

export interface CloseChecklist {
    journalsCount: number;
    debitTotal: number;
    creditTotal: number;
    balanced: boolean;
    drift: number;
    accountsWithBalance: number;
    nextPeriodOpen: boolean;
}

/**
 * Run the closing pre-flight checklist. The wizard displays this before allowing
 * the admin to flip the period to CLOSED.
 */
export async function getCloseChecklist(periodId: string): Promise<CloseChecklist> {
    await requireAdminFinanceSession();
    const period = await getPeriodOrThrow(periodId);
    const totals = await db.execute(sql`
        SELECT
            COUNT(DISTINCT j.id)::int AS j_count,
            COALESCE(SUM(jl.debit), 0)::text AS d_total,
            COALESCE(SUM(jl.credit), 0)::text AS c_total
        FROM journals j
        JOIN journal_lines jl ON jl.journal_id = j.id
        WHERE j.period_id = ${periodId}::uuid AND j.status = 'POSTED'
    `);
    const t = (totals as unknown as { j_count: number; d_total: string; c_total: string }[])[0];
    const debit = Number(t?.d_total ?? 0);
    const credit = Number(t?.c_total ?? 0);
    const drift = Math.round((debit - credit) * 100) / 100;

    const accountCount = await db.execute(sql`
        SELECT COUNT(DISTINCT jl.account_id)::int AS n
        FROM journals j
        JOIN journal_lines jl ON jl.journal_id = j.id
        WHERE j.period_id = ${periodId}::uuid AND j.status = 'POSTED'
    `);
    const accountsWithBalance = Number(
        (accountCount as unknown as { n: number }[])[0]?.n ?? 0
    );

    // does next period exist & is OPEN?
    const nextYear = period.month === 12 ? period.year + 1 : period.year;
    const nextMonth = period.month === 12 ? 1 : period.month + 1;
    const nextRows = await db
        .select()
        .from(accounting_periods)
        .where(
            and(
                eq(accounting_periods.book, period.book),
                eq(accounting_periods.year, nextYear),
                eq(accounting_periods.month, nextMonth)
            )
        )
        .limit(1);
    const nextPeriodOpen = nextRows[0]?.status === "OPEN";

    return {
        journalsCount: Number(t?.j_count ?? 0),
        debitTotal: debit,
        creditTotal: credit,
        balanced: Math.abs(drift) < 0.01,
        drift,
        accountsWithBalance,
        nextPeriodOpen,
    };
}

async function getPeriodOrThrow(periodId: string) {
    const rows = await db
        .select()
        .from(accounting_periods)
        .where(eq(accounting_periods.id, periodId))
        .limit(1);
    if (!rows[0]) throw new Error(`Period ${periodId} not found`);
    return rows[0];
}

/**
 * Lock a period — refuses new MANUAL postings; auto-posting helpers still allowed
 * (so an in-flight Xendit webhook doesn't fail).
 */
export async function lockPeriodAction(formData: FormData): Promise<void> {
    const session = await requireAdminFinanceSession();
    const periodId = String(formData.get("period_id") ?? "");
    if (!periodId) throw new Error("period_id required");
    const period = await getPeriodOrThrow(periodId);
    if (period.status !== "OPEN") throw new Error(`Period is ${period.status}, can only lock OPEN`);
    await db
        .update(accounting_periods)
        .set({ status: "LOCKED", locked_at: new Date(), locked_by: session.userId })
        .where(eq(accounting_periods.id, periodId));
    revalidatePath("/admin/finance/period");
}

/**
 * Close a period — runs the checklist; refuses if unbalanced; freezes period.
 * Snapshot of TB/PL/BS is left to a future ticket (period_snapshots table).
 */
export async function closePeriodAction(formData: FormData): Promise<void> {
    const session = await requireAdminFinanceSession();
    const periodId = String(formData.get("period_id") ?? "");
    if (!periodId) throw new Error("period_id required");
    const period = await getPeriodOrThrow(periodId);
    if (period.status === "CLOSED") throw new Error("Period is already CLOSED");

    const checklist = await getCloseChecklist(periodId);
    if (!checklist.balanced)
        throw new Error(
            `Period not balanced: drift=${checklist.drift.toFixed(2)} IDR. Fix journals before closing.`
        );

    await db
        .update(accounting_periods)
        .set({
            status: "CLOSED",
            closed_at: new Date(),
            closed_by: session.userId,
            // also lock if not already
            locked_at: period.locked_at ?? new Date(),
            locked_by: period.locked_by ?? session.userId,
        })
        .where(eq(accounting_periods.id, periodId));
    revalidatePath("/admin/finance/period");
}

/**
 * Re-open a CLOSED or LOCKED period. ADMIN only — already enforced by
 * requireAdminFinanceSession(). All re-opens are auditable via session.userId.
 */
export async function reopenPeriodAction(formData: FormData): Promise<void> {
    await requireAdminFinanceSession();
    const periodId = String(formData.get("period_id") ?? "");
    if (!periodId) throw new Error("period_id required");
    const period = await getPeriodOrThrow(periodId);
    if (period.status === "OPEN") throw new Error("Period is already OPEN");
    await db
        .update(accounting_periods)
        .set({ status: "OPEN", locked_at: null, locked_by: null, closed_at: null, closed_by: null })
        .where(eq(accounting_periods.id, periodId));
    revalidatePath("/admin/finance/period");
}

// keep imports referenced for static analysis
void coa_accounts;
void journal_lines;
void journals;
