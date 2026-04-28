"use server";

/**
 * GL — Seller sub-ledger (tier-1.5).
 *
 * Reads PLATFORM-book journal_lines tagged with partner_role='SELLER' to
 * derive per-seller wallet balance (account 22000 — Utang ke Seller / wallet
 * payable), YTD gross commission charged (41000 — Pendapatan Komisi for which
 * this seller is the partner counterparty), YTD payouts processed.
 *
 * NOTE: this is the read-side only. Posting helpers continue to write a single
 * PLATFORM-book journal that simply tags the seller via partner_user_id.
 * Tier-2 full per-seller GL with its own COA is deferred.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface SellerLedgerSummary {
    sellerId: string;
    name: string | null;
    email: string | null;
    walletBalance: number;       // CR balance on 22000 (positive = owed to seller)
    ytdGrossSales: number;        // CR balance on 41000+24100 contributed to platform via this seller
    ytdCommissionCharged: number; // SUM credit on 41000 attributed to this seller
    ytdPayouts: number;           // SUM debit on 22000 partnered to this seller (wallet drains)
    ytdRefundsImpact: number;     // SUM debit on 22000 from refund journals (commission reversal)
}

const YEAR_FILTER_SQL = (year: number) =>
    sql`EXTRACT(YEAR FROM j.posted_at) = ${year}`;

export async function getSellerLedgerSummary(
    sellerId: string,
    year: number = new Date().getUTCFullYear()
): Promise<SellerLedgerSummary> {
    // Wallet balance (lifetime) on 22000 + YTD movements
    const walletRows = await db.execute(sql`
        SELECT
            COALESCE(SUM(jl.credit - jl.debit), 0)::text AS wallet_balance,
            COALESCE(SUM(CASE WHEN ${YEAR_FILTER_SQL(year)} THEN jl.debit END), 0)::text AS ytd_payouts
        FROM journal_lines jl
        JOIN journals j ON j.id = jl.journal_id
        JOIN coa_accounts c ON c.id = jl.account_id
        WHERE jl.partner_user_id = ${sellerId}
          AND jl.partner_role = 'SELLER'
          AND c.code = '22000'
          AND j.status = 'POSTED'
    `);
    type W = { wallet_balance: string; ytd_payouts: string };
    const w = (walletRows as unknown as W[])[0] ?? { wallet_balance: "0", ytd_payouts: "0" };

    // From sales_register: per-seller gross/commission/refund totals for the year.
    // sales_register is the canonical per-line read-side that already aggregates
    // platform fee (commission to platform) per seller.
    const salesRows = await db.execute(sql`
        SELECT
            COALESCE(SUM(CASE WHEN sr.event = 'SALE' THEN sr.gross END), 0)::text AS gross_sales,
            COALESCE(SUM(CASE WHEN sr.event = 'SALE' THEN sr.platform_fee END), 0)::text AS commission_charged,
            COALESCE(SUM(CASE WHEN sr.event = 'REFUND' THEN sr.gross END), 0)::text AS refunds_gross
        FROM sales_register sr
        WHERE sr.seller_id = ${sellerId}
          AND EXTRACT(YEAR FROM sr.event_at) = ${year}
    `);
    type S = { gross_sales: string; commission_charged: string; refunds_gross: string };
    const s = (salesRows as unknown as S[])[0] ?? { gross_sales: "0", commission_charged: "0", refunds_gross: "0" };

    const userRows = await db.execute(sql`
        SELECT name, email FROM users WHERE id = ${sellerId} LIMIT 1
    `);
    const u = (userRows as unknown as { name: string | null; email: string | null }[])[0];

    return {
        sellerId,
        name: u?.name ?? null,
        email: u?.email ?? null,
        walletBalance: Number(w.wallet_balance),
        ytdGrossSales: Number(s.gross_sales),
        ytdCommissionCharged: Number(s.commission_charged),
        ytdPayouts: Number(w.ytd_payouts),
        ytdRefundsImpact: Number(s.refunds_gross),
    };
}

export async function listSellerLedgerSummaries(
    year: number = new Date().getUTCFullYear()
): Promise<SellerLedgerSummary[]> {
    const idRows = await db.execute(sql`
        SELECT DISTINCT jl.partner_user_id AS id
        FROM journal_lines jl
        JOIN journals j ON j.id = jl.journal_id
        WHERE jl.partner_role = 'SELLER'
          AND jl.partner_user_id IS NOT NULL
          AND j.status = 'POSTED'
    `);
    const ids = (idRows as unknown as { id: string }[]).map((r) => r.id).filter(Boolean);
    const out: SellerLedgerSummary[] = [];
    for (const id of ids) out.push(await getSellerLedgerSummary(id, year));
    out.sort((a, b) => b.walletBalance - a.walletBalance);
    return out;
}

export interface SellerLedgerEntry {
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

export async function getSellerLedgerHistory(
    sellerId: string,
    limit = 200
): Promise<SellerLedgerEntry[]> {
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
        WHERE jl.partner_user_id = ${sellerId}
          AND jl.partner_role = 'SELLER'
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
