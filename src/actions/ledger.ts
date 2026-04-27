"use server";

import { db } from "@/db";
import { ledger_accounts, ledger_entries } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

type AccountType = "PLATFORM" | "USER_WALLET" | "ESCROW" | "EXTERNAL";

interface AccountRef {
    type: AccountType;
    ownerUserId?: string | null;
    name?: string;
    currency?: string;
}

interface EntryLine {
    account: AccountRef;
    debit?: number;
    credit?: number;
    refType: string;
    refId: string;
    memo?: string;
    currency?: string;
}

async function getOrCreateAccount(ref: AccountRef): Promise<string> {
    const currency = ref.currency ?? "IDR";
    const existing = await db
        .select({ id: ledger_accounts.id })
        .from(ledger_accounts)
        .where(
            and(
                eq(ledger_accounts.type, ref.type),
                eq(ledger_accounts.currency, currency),
                ref.ownerUserId
                    ? eq(ledger_accounts.owner_user_id, ref.ownerUserId)
                    : sql`${ledger_accounts.owner_user_id} IS NULL`
            )
        )
        .limit(1);

    if (existing[0]) return existing[0].id;

    const [created] = await db
        .insert(ledger_accounts)
        .values({
            type: ref.type,
            owner_user_id: ref.ownerUserId ?? null,
            name: ref.name ?? `${ref.type}${ref.ownerUserId ? `:${ref.ownerUserId}` : ""}`,
            currency,
        })
        .returning({ id: ledger_accounts.id });

    return created.id;
}

/**
 * Write a balanced double-entry group. Throws if debits and credits do not net.
 * Each line must specify exactly one of debit or credit (DB-level CHECK enforces).
 */
export async function writeLedgerEntries(lines: EntryLine[], options?: { groupId?: string }): Promise<{ groupId: string }> {
    if (lines.length === 0) {
        throw new Error("Ledger group cannot be empty");
    }

    const totals = lines.reduce(
        (acc, line) => {
            acc.debit += Number(line.debit ?? 0);
            acc.credit += Number(line.credit ?? 0);
            return acc;
        },
        { debit: 0, credit: 0 }
    );

    if (Math.abs(totals.debit - totals.credit) > 0.001) {
        throw new Error(`Ledger group is unbalanced: debit ${totals.debit} vs credit ${totals.credit}`);
    }

    const groupId = options?.groupId ?? randomUUID();

    const rows: typeof ledger_entries.$inferInsert[] = [];
    for (const line of lines) {
        const accountId = await getOrCreateAccount(line.account);
        rows.push({
            entry_group_id: groupId,
            account_id: accountId,
            debit: String(line.debit ?? 0),
            credit: String(line.credit ?? 0),
            currency: line.currency ?? line.account.currency ?? "IDR",
            ref_type: line.refType,
            ref_id: line.refId,
            memo: line.memo,
        });
    }

    await db.insert(ledger_entries).values(rows);

    return { groupId };
}

/**
 * Buyer paid → flow funds into platform escrow until the order completes.
 * EXTERNAL (gateway) → ESCROW.
 */
export async function recordOrderPayment(opts: {
    orderId: string;
    buyerId: string;
    amount: number;
    currency?: string;
}) {
    return writeLedgerEntries(
        [
            {
                account: { type: "EXTERNAL", name: "PAYMENT_GATEWAY" },
                credit: opts.amount,
                refType: "ORDER",
                refId: opts.orderId,
                memo: "Buyer payment received from gateway",
            },
            {
                account: { type: "ESCROW", name: "PLATFORM_ESCROW" },
                debit: opts.amount,
                refType: "ORDER",
                refId: opts.orderId,
                memo: `Hold buyer ${opts.buyerId} payment in escrow`,
            },
        ],
        { groupId: undefined }
    );
}

/**
 * Order completed → release escrow, deduct platform fee, credit seller wallet.
 */
export async function recordOrderRelease(opts: {
    orderId: string;
    sellerId: string;
    grossAmount: number;
    platformFee: number;
    currency?: string;
}) {
    const sellerNet = opts.grossAmount - opts.platformFee;
    if (sellerNet < 0) {
        throw new Error(`Platform fee ${opts.platformFee} exceeds gross ${opts.grossAmount}`);
    }

    const lines: EntryLine[] = [
        {
            account: { type: "ESCROW", name: "PLATFORM_ESCROW" },
            credit: opts.grossAmount,
            refType: "ORDER",
            refId: opts.orderId,
            memo: "Release escrow on order completion",
        },
        {
            account: { type: "USER_WALLET", ownerUserId: opts.sellerId, name: `WALLET:${opts.sellerId}` },
            debit: sellerNet,
            refType: "ORDER",
            refId: opts.orderId,
            memo: "Net payout to seller wallet",
        },
    ];

    if (opts.platformFee > 0) {
        lines.push({
            account: { type: "PLATFORM", name: "PLATFORM_REVENUE" },
            debit: opts.platformFee,
            refType: "ORDER",
            refId: opts.orderId,
            memo: "Platform fee revenue",
        });
    }

    return writeLedgerEntries(lines);
}

/**
 * Refund: reverse the payment side.
 */
export async function recordOrderRefund(opts: {
    orderId: string;
    buyerId: string;
    amount: number;
    currency?: string;
}) {
    return writeLedgerEntries([
        {
            account: { type: "ESCROW", name: "PLATFORM_ESCROW" },
            credit: opts.amount,
            refType: "ORDER_REFUND",
            refId: opts.orderId,
            memo: `Refund to buyer ${opts.buyerId}`,
        },
        {
            account: { type: "EXTERNAL", name: "PAYMENT_GATEWAY" },
            debit: opts.amount,
            refType: "ORDER_REFUND",
            refId: opts.orderId,
            memo: "Refund disbursed via gateway",
        },
    ]);
}
