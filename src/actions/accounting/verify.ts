"use server";

/**
 * GL-31 — Integrity verification.
 *
 * Runs a battery of checks on the GL and returns a structured report.
 * Intended for a) on-demand admin check, b) periodic cron health probe.
 *
 * Checks:
 *   1. Every POSTED journal: sum(debit) == sum(credit) per journal
 *   2. Per book/period totals: sum(debit) == sum(credit)
 *   3. Trial balance: sum(debit) == sum(credit) across all POSTED journals
 *   4. No POSTED journal references a non-existent or wrong period
 *   5. journal_no uniqueness per book
 *   6. No journal_lines without a parent journal (FK already enforces, but cheap to assert)
 *   7. sales_register: gross == discount + (seller_net + platform_fee + affiliate_commission)
 *      tolerated by ±0.01 sen rounding
 */

import { db } from "@/db";
import { journals, journal_lines, accounting_periods, sales_register } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { runGlReconciliation } from "./reconciliation";

const TOLERANCE = 0.01;

export interface CheckResult {
    name: string;
    passed: boolean;
    detail: string;
    sample?: unknown[];
}

export interface VerifyReport {
    ranAt: string;
    durationMs: number;
    passed: boolean;
    checks: CheckResult[];
    reconciliation?: Awaited<ReturnType<typeof runGlReconciliation>> | null;
}

function fmt(n: number): string {
    return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function verifyGlIntegrity(opts?: {
    includeReconciliation?: boolean;
    maxSamples?: number;
}): Promise<VerifyReport> {
    const startedAt = Date.now();
    const sampleLimit = opts?.maxSamples ?? 10;
    const checks: CheckResult[] = [];

    // 1. Per-journal balance
    const unbalancedJournals = await db.execute(sql`
        SELECT j.id, j.journal_no, j.book,
               coalesce(sum(l.debit::numeric), 0)  as total_debit,
               coalesce(sum(l.credit::numeric), 0) as total_credit
        FROM journals j
        LEFT JOIN journal_lines l ON l.journal_id = j.id
        WHERE j.status = 'POSTED'
        GROUP BY j.id, j.journal_no, j.book
        HAVING abs(coalesce(sum(l.debit::numeric), 0) - coalesce(sum(l.credit::numeric), 0)) > ${TOLERANCE}
        LIMIT ${sampleLimit}
    `);
    checks.push({
        name: "per_journal_balance",
        passed: unbalancedJournals.length === 0,
        detail:
            unbalancedJournals.length === 0
                ? "Semua POSTED journals balanced (debit = kredit)"
                : `${unbalancedJournals.length} journal tidak balanced`,
        sample: unbalancedJournals.slice(0, sampleLimit),
    });

    // 2. Per book/period totals
    const periodTotals = await db.execute(sql`
        SELECT j.book, j.period_id,
               coalesce(sum(l.debit::numeric), 0)  as total_debit,
               coalesce(sum(l.credit::numeric), 0) as total_credit
        FROM journals j
        JOIN journal_lines l ON l.journal_id = j.id
        WHERE j.status = 'POSTED'
        GROUP BY j.book, j.period_id
        HAVING abs(coalesce(sum(l.debit::numeric), 0) - coalesce(sum(l.credit::numeric), 0)) > ${TOLERANCE}
    `);
    checks.push({
        name: "period_totals_balance",
        passed: periodTotals.length === 0,
        detail:
            periodTotals.length === 0
                ? "Semua periode balanced per book"
                : `${periodTotals.length} period tidak balanced`,
        sample: periodTotals,
    });

    // 3. Global trial balance
    const grand = await db
        .select({
            debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
        })
        .from(journal_lines)
        .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
        .where(eq(journals.status, "POSTED"));
    const gd = parseFloat(grand[0]?.debit ?? "0");
    const gc = parseFloat(grand[0]?.credit ?? "0");
    const grandPass = Math.abs(gd - gc) <= TOLERANCE;
    checks.push({
        name: "global_trial_balance",
        passed: grandPass,
        detail: grandPass
            ? `Total debit = total kredit = ${fmt(gd)}`
            : `Total debit ${fmt(gd)} ≠ total kredit ${fmt(gc)} (selisih ${fmt(gd - gc)})`,
    });

    // 4. Posted_at within period bounds
    const outOfPeriod = await db.execute(sql`
        SELECT j.id, j.journal_no, j.posted_at, p.starts_at, p.ends_at
        FROM journals j
        JOIN accounting_periods p ON p.id = j.period_id
        WHERE j.status = 'POSTED'
          AND (j.posted_at::date < p.starts_at OR j.posted_at::date > p.ends_at)
        LIMIT ${sampleLimit}
    `);
    checks.push({
        name: "posted_at_within_period",
        passed: outOfPeriod.length === 0,
        detail:
            outOfPeriod.length === 0
                ? "Semua posted_at berada dalam rentang period"
                : `${outOfPeriod.length} journal posted_at di luar period`,
        sample: outOfPeriod,
    });

    // 5. journal_no uniqueness per book (DB constraint enforces, but assert anyway)
    const dupNos = await db.execute(sql`
        SELECT book, journal_no, count(*) as cnt
        FROM journals
        GROUP BY book, journal_no
        HAVING count(*) > 1
        LIMIT ${sampleLimit}
    `);
    checks.push({
        name: "journal_no_unique_per_book",
        passed: dupNos.length === 0,
        detail: dupNos.length === 0 ? "journal_no unik per book" : `${dupNos.length} duplikat`,
        sample: dupNos,
    });

    // 6. Orphan journal_lines (FK enforces, but defensive)
    const orphans = await db.execute(sql`
        SELECT l.id FROM journal_lines l
        LEFT JOIN journals j ON j.id = l.journal_id
        WHERE j.id IS NULL
        LIMIT ${sampleLimit}
    `);
    checks.push({
        name: "no_orphan_journal_lines",
        passed: orphans.length === 0,
        detail: orphans.length === 0 ? "Tidak ada orphan lines" : `${orphans.length} orphan ditemukan`,
        sample: orphans,
    });

    // 7. sales_register internal consistency:
    //    seller_net + platform_fee + affiliate_commission ≈ gross - discount
    //    (within 0.01 tolerance; shipping is passthrough excluded from this identity)
    const inconsistentSr = await db.execute(sql`
        SELECT id, order_item_id, gross, discount, platform_fee, seller_net, affiliate_commission,
               (gross::numeric - discount::numeric)
                  - (seller_net::numeric + platform_fee::numeric + affiliate_commission::numeric) as diff
        FROM sales_register
        WHERE event = 'SALE'
          AND abs(
                (gross::numeric - discount::numeric)
                - (seller_net::numeric + platform_fee::numeric + affiliate_commission::numeric)
              ) > ${TOLERANCE}
        LIMIT ${sampleLimit}
    `);
    checks.push({
        name: "sales_register_identity",
        passed: inconsistentSr.length === 0,
        detail:
            inconsistentSr.length === 0
                ? "sales_register: gross - discount = seller_net + platform_fee + affiliate_commission (±0.01)"
                : `${inconsistentSr.length} baris sales_register inkonsisten`,
        sample: inconsistentSr,
    });

    // 8. Reconciliation (legacy ledger vs GL) — optional because it can be slow
    let reconciliation = null;
    if (opts?.includeReconciliation !== false) {
        try {
            reconciliation = await runGlReconciliation();
        } catch (err) {
            checks.push({
                name: "reconciliation_runner",
                passed: false,
                detail: `Reconciliation failed: ${err instanceof Error ? err.message : String(err)}`,
            });
        }
    }

    const passed = checks.every((c) => c.passed);
    return {
        ranAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        passed,
        checks,
        reconciliation,
    };
}

// Suppress unused-import lint when reconciliation excluded
void accounting_periods;
void sales_register;
