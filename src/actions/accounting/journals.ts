"use server";

import { db } from "@/db";
import {
    accounting_periods,
    coa_accounts,
    journal_lines,
    journals,
    type journalSourceEnum,
    type ledgerBookEnum,
    type taxKindEnum,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSetting } from "./settings";

export type LedgerBook = (typeof ledgerBookEnum.enumValues)[number];
export type JournalSource = (typeof journalSourceEnum.enumValues)[number];
export type TaxKind = (typeof taxKindEnum.enumValues)[number];

export interface JournalLineInput {
    accountCode: string; // resolved to coa_accounts.id
    debit?: number;
    credit?: number;
    memo?: string;
    partnerUserId?: string | null;
    partnerRole?: "SELLER" | "AFFILIATE" | "BUYER" | null;
    taxKind?: TaxKind | null;
    taxBase?: number;
    taxRate?: number;
    currency?: string;
}

export interface PostJournalInput {
    book?: LedgerBook;
    bookOwnerId?: string | null;
    postedAt?: Date;
    source: JournalSource;
    description: string;
    refType?: string;
    refId?: string;
    idempotencyKey?: string;
    lines: JournalLineInput[];
    createdBy?: string;
}

export interface PostJournalResult {
    journalId: string;
    journalNo: string;
    alreadyExisted: boolean;
}

const TOLERANCE = 0.01; // 1 sen

/**
 * round2 — banker's rounding (HALF_EVEN) by default; HALF_UP if so configured.
 * Pure function; called for all amount inputs to avoid floating-point drift.
 */
function round2(n: number, mode: "HALF_EVEN" | "HALF_UP" = "HALF_EVEN"): number {
    if (!Number.isFinite(n)) throw new Error(`amount not finite: ${n}`);
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const scaled = abs * 100;
    let rounded: number;
    if (mode === "HALF_UP") {
        rounded = Math.round(scaled);
    } else {
        // HALF_EVEN
        const floor = Math.floor(scaled);
        const diff = scaled - floor;
        if (diff > 0.5) rounded = floor + 1;
        else if (diff < 0.5) rounded = floor;
        else rounded = floor % 2 === 0 ? floor : floor + 1;
    }
    return (sign * rounded) / 100;
}

function toNumeric(n: number): string {
    return n.toFixed(2);
}

/**
 * postJournal — single canonical entrypoint to write a balanced double-entry journal.
 *
 * Validation:
 *  1. lines.length >= 2
 *  2. each line: exactly one of debit/credit > 0
 *  3. SUM(debit) === SUM(credit) (within 0.01 IDR)
 *  4. postedAt falls within an OPEN period for the given book
 *  5. idempotency: if idempotency_key already exists -> return existing journalId
 *  6. all accountCodes must resolve, be is_postable=true, is_active=true, book matches
 *  7. currency: if currency.allow_multi=false (default) -> all lines must be IDR
 *  8. SELLER book requires bookOwnerId
 *
 * Atomicity: entire write inside one DB transaction; rollback on any violation.
 */
export async function postJournal(
    input: PostJournalInput
): Promise<PostJournalResult> {
    const book: LedgerBook = input.book ?? "PLATFORM";
    const postedAt = input.postedAt ?? new Date();

    if (book === "SELLER" && !input.bookOwnerId) {
        throw new Error("postJournal: bookOwnerId required for SELLER book");
    }
    if (input.lines.length < 2) {
        throw new Error("postJournal: a journal needs at least 2 lines");
    }

    // Idempotency check (outside tx so we can early-return without locking)
    if (input.idempotencyKey) {
        const existing = await db
            .select({ id: journals.id, journal_no: journals.journal_no })
            .from(journals)
            .where(eq(journals.idempotency_key, input.idempotencyKey))
            .limit(1);
        if (existing[0]) {
            return {
                journalId: existing[0].id,
                journalNo: existing[0].journal_no,
                alreadyExisted: true,
            };
        }
    }

    // Resolve currency policy
    const baseCurrency =
        (await getSetting<string>("entity.base_currency", { at: postedAt })) ?? "IDR";
    const allowMulti =
        (await getSetting<boolean>("currency.allow_multi", { at: postedAt })) ?? false;
    const roundingMode =
        (await getSetting<"HALF_EVEN" | "HALF_UP">("posting.rounding_strategy", {
            at: postedAt,
        })) ?? "HALF_EVEN";

    // Normalize & validate each line
    type NormLine = {
        line_no: number;
        accountCode: string;
        debit: number;
        credit: number;
        currency: string;
        memo: string | null;
        partner_user_id: string | null;
        partner_role: string | null;
        tax_kind: TaxKind | null;
        tax_base: number | null;
        tax_rate: number | null;
    };
    const normalized: NormLine[] = [];
    let sumDebit = 0;
    let sumCredit = 0;

    for (let i = 0; i < input.lines.length; i++) {
        const ln = input.lines[i];
        const debit = round2(ln.debit ?? 0, roundingMode);
        const credit = round2(ln.credit ?? 0, roundingMode);
        const hasDebit = debit > 0;
        const hasCredit = credit > 0;
        if (hasDebit === hasCredit) {
            throw new Error(
                `postJournal: line ${i + 1} must have exactly one of debit OR credit > 0 (got debit=${debit}, credit=${credit})`
            );
        }
        if (debit < 0 || credit < 0) {
            throw new Error(`postJournal: line ${i + 1} amounts must be non-negative`);
        }
        const cur = ln.currency ?? baseCurrency;
        if (!allowMulti && cur !== baseCurrency) {
            throw new Error(
                `postJournal: line ${i + 1} currency=${cur} but allow_multi=false (base=${baseCurrency})`
            );
        }
        normalized.push({
            line_no: i + 1,
            accountCode: ln.accountCode,
            debit,
            credit,
            currency: cur,
            memo: ln.memo ?? null,
            partner_user_id: ln.partnerUserId ?? null,
            partner_role: ln.partnerRole ?? null,
            tax_kind: ln.taxKind ?? null,
            tax_base: ln.taxBase != null ? round2(ln.taxBase, roundingMode) : null,
            tax_rate: ln.taxRate ?? null,
        });
        sumDebit += debit;
        sumCredit += credit;
    }

    if (Math.abs(sumDebit - sumCredit) > TOLERANCE) {
        throw new Error(
            `postJournal: unbalanced — sumDebit=${sumDebit} sumCredit=${sumCredit} diff=${sumDebit - sumCredit}`
        );
    }

    // Resolve accounts
    const codes = Array.from(new Set(normalized.map((l) => l.accountCode)));
    const accounts = await db
        .select({
            id: coa_accounts.id,
            code: coa_accounts.code,
            book: coa_accounts.book,
            is_postable: coa_accounts.is_postable,
            is_active: coa_accounts.is_active,
            currency: coa_accounts.currency,
        })
        .from(coa_accounts)
        .where(
            and(
                sql`${coa_accounts.code} = ANY(${codes})`,
                eq(coa_accounts.book, book)
            )
        );
    const accountMap = new Map(accounts.map((a) => [a.code, a]));
    for (const code of codes) {
        const acc = accountMap.get(code);
        if (!acc)
            throw new Error(
                `postJournal: account code '${code}' not found in book='${book}'`
            );
        if (!acc.is_postable)
            throw new Error(`postJournal: account '${code}' is_postable=false (header)`);
        if (!acc.is_active)
            throw new Error(`postJournal: account '${code}' is_active=false`);
    }

    // Resolve open period for postedAt
    const year = postedAt.getUTCFullYear();
    const month = postedAt.getUTCMonth() + 1;
    const period = await ensureOpenPeriod(book, year, month);
    if (period.status !== "OPEN") {
        throw new Error(
            `postJournal: period ${year}-${String(month).padStart(2, "0")} is ${period.status}, posting rejected`
        );
    }

    // Generate journal_no JV-YYYYMM-000001 (sequence per book/period)
    const seqRow = await db.execute<{ next_no: number }>(sql`
        SELECT COALESCE(MAX(
          CAST(NULLIF(SUBSTRING(journal_no FROM '[0-9]+$'), '') AS INTEGER)
        ), 0) + 1 AS next_no
        FROM journals
        WHERE book = ${book}
          AND period_id = ${period.id}
    `);
    const nextNo = Number(seqRow[0]?.next_no ?? 1);
    const journalNo = `JV-${year}${String(month).padStart(2, "0")}-${String(nextNo).padStart(6, "0")}`;

    // Atomic write inside a transaction
    return await db.transaction(async (tx) => {
        // Re-check idempotency inside tx (race-safety)
        if (input.idempotencyKey) {
            const existing = await tx
                .select({ id: journals.id, journal_no: journals.journal_no })
                .from(journals)
                .where(eq(journals.idempotency_key, input.idempotencyKey))
                .limit(1);
            if (existing[0]) {
                return {
                    journalId: existing[0].id,
                    journalNo: existing[0].journal_no,
                    alreadyExisted: true,
                };
            }
        }

        const [journalRow] = await tx
            .insert(journals)
            .values({
                book,
                book_owner_id: input.bookOwnerId ?? null,
                period_id: period.id,
                journal_no: journalNo,
                posted_at: postedAt,
                source: input.source,
                description: input.description,
                ref_type: input.refType ?? null,
                ref_id: input.refId ?? null,
                status: "POSTED",
                idempotency_key: input.idempotencyKey ?? null,
                created_by: input.createdBy ?? null,
            })
            .returning({ id: journals.id, journal_no: journals.journal_no });

        const lineRows = normalized.map((l) => {
            const acc = accountMap.get(l.accountCode)!;
            return {
                journal_id: journalRow.id,
                line_no: l.line_no,
                account_id: acc.id,
                debit: toNumeric(l.debit) as never,
                credit: toNumeric(l.credit) as never,
                currency: l.currency,
                memo: l.memo,
                partner_user_id: l.partner_user_id,
                partner_role: l.partner_role,
                tax_kind: l.tax_kind,
                tax_base: l.tax_base != null ? (toNumeric(l.tax_base) as never) : null,
                tax_rate: l.tax_rate != null ? (l.tax_rate.toString() as never) : null,
            };
        });
        await tx.insert(journal_lines).values(lineRows);

        return {
            journalId: journalRow.id,
            journalNo: journalRow.journal_no,
            alreadyExisted: false,
        };
    });
}

/**
 * ensureOpenPeriod — get-or-create a period row for (book, year, month). Defaults to OPEN.
 * Used by postJournal so the first posting in a new month auto-opens that period.
 */
async function ensureOpenPeriod(book: LedgerBook, year: number, month: number) {
    const existing = await db
        .select()
        .from(accounting_periods)
        .where(
            and(
                eq(accounting_periods.book, book),
                eq(accounting_periods.year, year),
                eq(accounting_periods.month, month)
            )
        )
        .limit(1);
    if (existing[0]) return existing[0];

    const startsAt = new Date(Date.UTC(year, month - 1, 1));
    const endsAt = new Date(Date.UTC(year, month, 0));
    const [created] = await db
        .insert(accounting_periods)
        .values({
            book,
            year,
            month,
            starts_at: startsAt.toISOString().slice(0, 10),
            ends_at: endsAt.toISOString().slice(0, 10),
            status: "OPEN",
        })
        .returning();
    return created;
}

/**
 * reverseJournal — write a balanced reversing entry that mirrors the original.
 * The original journal is kept as POSTED; its status becomes REVERSED via DB rule
 * checked at read time (or set explicitly here).
 */
export async function reverseJournal(
    originalJournalId: string,
    opts: { reason: string; postedAt?: Date; createdBy?: string }
): Promise<PostJournalResult> {
    const orig = await db
        .select()
        .from(journals)
        .where(eq(journals.id, originalJournalId))
        .limit(1);
    if (!orig[0]) throw new Error(`reverseJournal: journal ${originalJournalId} not found`);
    if (orig[0].status !== "POSTED")
        throw new Error(
            `reverseJournal: journal status is ${orig[0].status}, only POSTED can be reversed`
        );

    const lines = await db
        .select({
            line_no: journal_lines.line_no,
            account_id: journal_lines.account_id,
            debit: journal_lines.debit,
            credit: journal_lines.credit,
            currency: journal_lines.currency,
            memo: journal_lines.memo,
            partner_user_id: journal_lines.partner_user_id,
            partner_role: journal_lines.partner_role,
            tax_kind: journal_lines.tax_kind,
            tax_base: journal_lines.tax_base,
            tax_rate: journal_lines.tax_rate,
            account_code: coa_accounts.code,
        })
        .from(journal_lines)
        .innerJoin(coa_accounts, eq(coa_accounts.id, journal_lines.account_id))
        .where(eq(journal_lines.journal_id, originalJournalId));

    const reversed = await postJournal({
        book: orig[0].book,
        bookOwnerId: orig[0].book_owner_id ?? undefined,
        postedAt: opts.postedAt ?? new Date(),
        source: orig[0].source,
        description: `REVERSE ${orig[0].journal_no}: ${opts.reason}`,
        refType: orig[0].ref_type ?? undefined,
        refId: orig[0].ref_id ?? undefined,
        idempotencyKey: `REVERSE:${originalJournalId}`,
        createdBy: opts.createdBy,
        lines: lines.map((l) => ({
            accountCode: l.account_code,
            debit: Number(l.credit), // swap
            credit: Number(l.debit),
            currency: l.currency,
            memo: l.memo ?? undefined,
            partnerUserId: l.partner_user_id ?? null,
            partnerRole:
                (l.partner_role as "SELLER" | "AFFILIATE" | "BUYER" | null) ?? null,
            taxKind: (l.tax_kind as TaxKind | null) ?? null,
            taxBase: l.tax_base != null ? Number(l.tax_base) : undefined,
            taxRate: l.tax_rate != null ? Number(l.tax_rate) : undefined,
        })),
    });

    if (!reversed.alreadyExisted) {
        await db
            .update(journals)
            .set({ status: "REVERSED", reverses_journal_id: reversed.journalId })
            .where(eq(journals.id, originalJournalId));
    }
    return reversed;
}
