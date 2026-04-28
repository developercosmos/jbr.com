"use server";

/**
 * GL-13 — Affiliate sub-ledger.
 *
 * Reads journal_lines aggregated by partner_user_id (partner_role='AFFILIATE') to
 * present per-affiliate wallet balance (account 22200 — Utang Komisi Affiliate),
 * year-to-date accrued commission expense (66000), and year-to-date tax withheld
 * (24200 PPh 23, 24300 PPh 21, 24400 PPh 4(2)).
 *
 * Tier-1 visibility: admin sees all affiliates; an enrolled affiliate sees only
 * their own row (queried via session.userId).
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface AffiliateLedgerSummary {
    affiliateUserId: string;
    name: string | null;
    email: string | null;
    walletBalance: number;        // CR balance on 22200 (positive = owed to affiliate)
    ytdAccrued: number;            // SUM debit on 66000 partnered to this affiliate
    ytdReversed: number;           // SUM credit on 66000 (clawback) partnered to this affiliate
    ytdPaid: number;               // SUM debit on 22200 partnered to this affiliate
    ytdWithheldPph21: number;
    ytdWithheldPph23: number;
    ytdWithheldPph42: number;
    ytdWithheldTotal: number;
}

const YEAR_FILTER_SQL = (year: number) =>
    sql`EXTRACT(YEAR FROM j.posted_at) = ${year}`;

/**
 * One affiliate's ledger summary for the year.
 */
export async function getAffiliateLedgerSummary(
    affiliateUserId: string,
    year: number = new Date().getUTCFullYear()
): Promise<AffiliateLedgerSummary> {
    const rows = await db.execute(sql`
        WITH lines AS (
            SELECT jl.account_id, jl.debit, jl.credit, c.code, c.normal_balance, j.posted_at
            FROM journal_lines jl
            JOIN journals j ON j.id = jl.journal_id
            JOIN coa_accounts c ON c.id = jl.account_id
            WHERE jl.partner_user_id = ${affiliateUserId}
              AND jl.partner_role = 'AFFILIATE'
              AND j.status = 'POSTED'
        )
        SELECT
            COALESCE(SUM(CASE WHEN code = '22200' THEN credit - debit END), 0)::text AS wallet_balance,
            COALESCE(SUM(CASE WHEN code = '66000' AND ${YEAR_FILTER_SQL(year)} THEN debit END), 0)::text AS ytd_accrued,
            COALESCE(SUM(CASE WHEN code = '66000' AND ${YEAR_FILTER_SQL(year)} THEN credit END), 0)::text AS ytd_reversed,
            COALESCE(SUM(CASE WHEN code = '22200' AND ${YEAR_FILTER_SQL(year)} THEN debit END), 0)::text AS ytd_paid
        FROM lines j
    `);
    type R = { wallet_balance: string; ytd_accrued: string; ytd_reversed: string; ytd_paid: string };
    const r = (rows as unknown as R[])[0] ?? { wallet_balance: "0", ytd_accrued: "0", ytd_reversed: "0", ytd_paid: "0" };

    // Tax withholding lives on whole-journal lines (no partner tag — they go to
    // the tax obligation account directly). Resolve via journals that DO touch
    // this affiliate's 22200 line in the same journal.
    const taxRows = await db.execute(sql`
        WITH affiliate_journals AS (
            SELECT DISTINCT j.id, j.posted_at
            FROM journals j
            JOIN journal_lines jl ON jl.journal_id = j.id
            JOIN coa_accounts c ON c.id = jl.account_id
            WHERE jl.partner_user_id = ${affiliateUserId}
              AND jl.partner_role = 'AFFILIATE'
              AND c.code = '22200'
              AND j.status = 'POSTED'
              AND ${YEAR_FILTER_SQL(year)}
        )
        SELECT
            COALESCE(SUM(CASE WHEN c.code = '24300' THEN jl.credit END), 0)::text AS pph21,
            COALESCE(SUM(CASE WHEN c.code = '24200' THEN jl.credit END), 0)::text AS pph23,
            COALESCE(SUM(CASE WHEN c.code = '24400' THEN jl.credit END), 0)::text AS pph42
        FROM affiliate_journals aj
        JOIN journal_lines jl ON jl.journal_id = aj.id
        JOIN coa_accounts c ON c.id = jl.account_id
    `);
    const t = (taxRows as unknown as { pph21: string; pph23: string; pph42: string }[])[0] ?? { pph21: "0", pph23: "0", pph42: "0" };

    // Affiliate user info
    const userRows = await db.execute(sql`
        SELECT name, email FROM users WHERE id = ${affiliateUserId} LIMIT 1
    `);
    const u = (userRows as unknown as { name: string | null; email: string | null }[])[0];

    const pph21 = Number(t.pph21);
    const pph23 = Number(t.pph23);
    const pph42 = Number(t.pph42);

    return {
        affiliateUserId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        walletBalance: Number(r.wallet_balance),
        ytdAccrued: Number(r.ytd_accrued),
        ytdReversed: Number(r.ytd_reversed),
        ytdPaid: Number(r.ytd_paid),
        ytdWithheldPph21: pph21,
        ytdWithheldPph23: pph23,
        ytdWithheldPph42: pph42,
        ytdWithheldTotal: Math.round((pph21 + pph23 + pph42) * 100) / 100,
    };
}

/**
 * List all affiliates that have any GL activity, with summary balances for the year.
 */
export async function listAffiliateLedgerSummaries(
    year: number = new Date().getUTCFullYear()
): Promise<AffiliateLedgerSummary[]> {
    const idRows = await db.execute(sql`
        SELECT DISTINCT jl.partner_user_id AS id
        FROM journal_lines jl
        JOIN journals j ON j.id = jl.journal_id
        WHERE jl.partner_role = 'AFFILIATE'
          AND jl.partner_user_id IS NOT NULL
          AND j.status = 'POSTED'
    `);
    const ids = (idRows as unknown as { id: string }[]).map((r) => r.id).filter(Boolean);
    const out: AffiliateLedgerSummary[] = [];
    for (const id of ids) out.push(await getAffiliateLedgerSummary(id, year));
    out.sort((a, b) => b.walletBalance - a.walletBalance);
    return out;
}

export interface AffiliateLedgerEntry {
    journalId: string;
    journalNo: string;
    postedAt: string;
    description: string;
    refType: string | null;
    refId: string | null;
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
    memo: string | null;
}

/**
 * Mutation history for one affiliate. Pulls every journal_line tagged with
 * partner_user_id=affiliateUserId AND partner_role='AFFILIATE'.
 */
export async function getAffiliateLedgerHistory(
    affiliateUserId: string,
    limit = 200
): Promise<AffiliateLedgerEntry[]> {
    const rows = await db.execute(sql`
        SELECT
            j.id AS journal_id,
            j.journal_no,
            j.posted_at,
            j.description,
            j.ref_type,
            j.ref_id,
            c.code AS account_code,
            c.name AS account_name,
            jl.debit::text AS debit,
            jl.credit::text AS credit,
            jl.memo
        FROM journal_lines jl
        JOIN journals j ON j.id = jl.journal_id
        JOIN coa_accounts c ON c.id = jl.account_id
        WHERE jl.partner_user_id = ${affiliateUserId}
          AND jl.partner_role = 'AFFILIATE'
          AND j.status = 'POSTED'
        ORDER BY j.posted_at DESC, c.code
        LIMIT ${limit}
    `);
    type R = {
        journal_id: string;
        journal_no: string;
        posted_at: string | Date;
        description: string;
        ref_type: string | null;
        ref_id: string | null;
        account_code: string;
        account_name: string;
        debit: string;
        credit: string;
        memo: string | null;
    };
    return (rows as unknown as R[]).map((r) => ({
        journalId: String(r.journal_id),
        journalNo: String(r.journal_no),
        postedAt: new Date(r.posted_at as string | Date).toISOString(),
        description: String(r.description),
        refType: r.ref_type,
        refId: r.ref_id,
        accountCode: String(r.account_code),
        accountName: String(r.account_name),
        debit: Number(r.debit),
        credit: Number(r.credit),
        memo: r.memo,
    }));
}
