"use server";

/**
 * GL-04 — Reconciliation between legacy ledger (ledger_entries) and new GL
 * (journals/journal_lines) during the dual-write phase.
 *
 * For each canonical balance pair we expect parity. Any drift exceeding
 * `gl.recon_alert_threshold_idr` is logged and (Phase 3) will notify finance.
 *
 * Initial pairs:
 *   - Escrow held:           legacy ESCROW.PLATFORM_ESCROW           ↔  GL 23000
 *   - Seller wallet total:   legacy USER_WALLET (per-owner sum)      ↔  GL 22000
 *   - Platform revenue:      legacy PLATFORM.PLATFORM_REVENUE        ↔  GL 41000 (DPP only) + 24100
 *
 * The legacy schema sums (debit - credit) per account; for liability accounts
 * the absolute balance is `credit - debit`. We compare absolute magnitudes so
 * sign convention doesn't matter.
 */

import { db } from "@/db";
import { ledger_accounts, ledger_entries, coa_accounts, journal_lines, journals } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { getSetting } from "./settings";
import { logger } from "@/lib/logger";

interface PairResult {
    pair: string;
    legacy: number;
    gl: number;
    drift: number;
    breached: boolean;
}

async function legacyAccountBalance(type: string, name: string): Promise<number> {
    const rows = await db
        .select({
            debit: sql<string>`coalesce(sum(${ledger_entries.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${ledger_entries.credit}::numeric), 0)`,
        })
        .from(ledger_entries)
        .innerJoin(ledger_accounts, eq(ledger_accounts.id, ledger_entries.account_id))
        .where(and(eq(ledger_accounts.type, type as never), eq(ledger_accounts.name, name)));
    const r = rows[0];
    if (!r) return 0;
    return Math.abs(Number(r.debit) - Number(r.credit));
}

async function legacyAccountTypeBalance(type: string): Promise<number> {
    const rows = await db
        .select({
            debit: sql<string>`coalesce(sum(${ledger_entries.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${ledger_entries.credit}::numeric), 0)`,
        })
        .from(ledger_entries)
        .innerJoin(ledger_accounts, eq(ledger_accounts.id, ledger_entries.account_id))
        .where(eq(ledger_accounts.type, type as never));
    const r = rows[0];
    if (!r) return 0;
    return Math.abs(Number(r.debit) - Number(r.credit));
}

async function glAccountBalance(code: string): Promise<number> {
    const rows = await db
        .select({
            debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
        })
        .from(journal_lines)
        .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
        .innerJoin(coa_accounts, eq(coa_accounts.id, journal_lines.account_id))
        .where(and(eq(coa_accounts.code, code), eq(journals.status, "POSTED")));
    const r = rows[0];
    if (!r) return 0;
    return Math.abs(Number(r.debit) - Number(r.credit));
}

export async function runGlReconciliation(): Promise<{
    threshold: number;
    pairs: PairResult[];
    breaches: number;
}> {
    const threshold = Number(
        (await getSetting<number>("gl.recon_alert_threshold_idr", { defaultValue: 1 })) ?? 1
    );

    const [escrowLegacy, escrowGl, walletLegacy, walletGl, revenueLegacy, revenue4100, revenue2410] =
        await Promise.all([
            legacyAccountBalance("ESCROW", "PLATFORM_ESCROW"),
            glAccountBalance("23000"),
            legacyAccountTypeBalance("USER_WALLET"),
            glAccountBalance("22000"),
            legacyAccountBalance("PLATFORM", "PLATFORM_REVENUE"),
            glAccountBalance("41000"),
            glAccountBalance("24100"),
        ]);

    const pairs: PairResult[] = [
        mkPair("escrow", escrowLegacy, escrowGl, threshold),
        mkPair("seller_wallets", walletLegacy, walletGl, threshold),
        mkPair("platform_revenue", revenueLegacy, revenue4100 + revenue2410, threshold),
    ];

    const breaches = pairs.filter((p) => p.breached).length;
    if (breaches > 0) {
        logger.error("gl:reconciliation_drift", {
            threshold,
            pairs: pairs.filter((p) => p.breached),
        });
    } else {
        logger.info("gl:reconciliation_ok", { threshold, pairs });
    }

    return { threshold, pairs, breaches };
}

function mkPair(name: string, legacy: number, gl: number, threshold: number): PairResult {
    const drift = Math.abs(legacy - gl);
    return {
        pair: name,
        legacy: Number(legacy.toFixed(2)),
        gl: Number(gl.toFixed(2)),
        drift: Number(drift.toFixed(2)),
        breached: drift > threshold,
    };
}
