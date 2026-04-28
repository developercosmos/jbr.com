"use server";

/**
 * GL-05 — Financial Report queries.
 *
 * All reports run against POSTED journals. They are pure read-only and
 * idempotent. Date filters are inclusive on `posted_at`.
 *
 * Reports implemented:
 *   - getTrialBalance({ from, to, book? })
 *   - getProfitLoss({ from, to, book? })
 *   - getBalanceSheet({ asOf, book? })
 *   - getGlForAccount({ accountCode, from, to, book? })
 *   - getSellerSalesSummary({ sellerId, from, to })   ← seller tier-1
 *   - getSellerSalesDetail({ sellerId, from, to })    ← seller tier-1
 *
 * Isolation:
 *   - getSellerSalesSummary/Detail accept sellerId but the routes calling them
 *     MUST derive that id from session (never trust client input). See
 *     src/lib/seller-finance.ts for the requireSellerId helper.
 */

import { db } from "@/db";
import { coa_accounts, journal_lines, journals, sales_register } from "@/db/schema";
import { and, eq, gte, lte, sql, asc, desc } from "drizzle-orm";
import type { LedgerBook } from "./journals";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------
export interface DateRange {
    from?: Date;
    to?: Date;
    book?: LedgerBook;
}

export interface AsOf {
    asOf?: Date;
    book?: LedgerBook;
}

export interface AccountBalanceRow {
    code: string;
    name: string;
    class: string;
    normalBalance: "DEBIT" | "CREDIT";
    debit: number;
    credit: number;
    /** debit - credit (positive = net debit). */
    netDebit: number;
    /** Magnitude in account's natural direction (always >= 0). */
    balance: number;
}

function toN(v: string | number | null | undefined): number {
    if (v === null || v === undefined) return 0;
    const n = typeof v === "string" ? parseFloat(v) : v;
    return Number.isFinite(n) ? n : 0;
}

// ---------------------------------------------------------------------------
// Trial Balance
// ---------------------------------------------------------------------------
export async function getTrialBalance(opts: DateRange = {}): Promise<{
    rows: AccountBalanceRow[];
    totalDebit: number;
    totalCredit: number;
    balanced: boolean;
    range: { from?: string; to?: string; book: LedgerBook };
}> {
    const book = (opts.book ?? "PLATFORM") as LedgerBook;

    const conditions = [eq(journals.status, "POSTED"), eq(journals.book, book)];
    if (opts.from) conditions.push(gte(journals.posted_at, opts.from));
    if (opts.to) conditions.push(lte(journals.posted_at, opts.to));

    const rows = await db
        .select({
            code: coa_accounts.code,
            name: coa_accounts.name,
            class: coa_accounts.class,
            normalBalance: coa_accounts.normal_balance,
            debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
        })
        .from(journal_lines)
        .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
        .innerJoin(coa_accounts, eq(coa_accounts.id, journal_lines.account_id))
        .where(and(...conditions))
        .groupBy(coa_accounts.code, coa_accounts.name, coa_accounts.class, coa_accounts.normal_balance)
        .orderBy(asc(coa_accounts.code));

    const enriched: AccountBalanceRow[] = rows.map((r) => {
        const debit = toN(r.debit);
        const credit = toN(r.credit);
        const netDebit = debit - credit;
        const balance =
            r.normalBalance === "DEBIT" ? netDebit : -netDebit;
        return {
            code: r.code,
            name: r.name,
            class: r.class,
            normalBalance: r.normalBalance as "DEBIT" | "CREDIT",
            debit,
            credit,
            netDebit,
            balance,
        };
    });

    const totalDebit = enriched.reduce((s, r) => s + r.debit, 0);
    const totalCredit = enriched.reduce((s, r) => s + r.credit, 0);

    return {
        rows: enriched,
        totalDebit,
        totalCredit,
        balanced: Math.abs(totalDebit - totalCredit) < 0.01,
        range: {
            from: opts.from?.toISOString(),
            to: opts.to?.toISOString(),
            book,
        },
    };
}

// ---------------------------------------------------------------------------
// Profit & Loss
// ---------------------------------------------------------------------------
export interface ProfitLossSection {
    label: string;
    rows: AccountBalanceRow[];
    subtotal: number;
}

export async function getProfitLoss(opts: DateRange = {}): Promise<{
    revenue: ProfitLossSection;
    contraRevenue: ProfitLossSection;
    cogs: ProfitLossSection;
    grossProfit: number;
    opex: ProfitLossSection;
    operatingProfit: number;
    otherIncome: ProfitLossSection;
    otherExpense: ProfitLossSection;
    profitBeforeTax: number;
    taxExpense: ProfitLossSection;
    netProfit: number;
    range: { from?: string; to?: string; book: LedgerBook };
}> {
    const tb = await getTrialBalance(opts);
    const byClass = (cls: string) => tb.rows.filter((r) => r.class === cls);

    const mkSection = (label: string, cls: string): ProfitLossSection => {
        const rows = byClass(cls);
        const subtotal = rows.reduce((s, r) => s + r.balance, 0);
        return { label, rows, subtotal };
    };

    const revenue = mkSection("Pendapatan", "REVENUE");
    const contraRevenue = mkSection("Diskon & Voucher", "CONTRA_REVENUE");
    const cogs = mkSection("Beban Pokok", "COGS");
    const opex = mkSection("Beban Operasional", "OPEX");
    const otherIncome = mkSection("Pendapatan Lain", "OTHER_INCOME");
    const otherExpense = mkSection("Beban Lain", "OTHER_EXPENSE");
    const taxExpense = mkSection("Beban Pajak Penghasilan", "TAX_EXPENSE");

    const netRevenue = revenue.subtotal - contraRevenue.subtotal;
    const grossProfit = netRevenue - cogs.subtotal;
    const operatingProfit = grossProfit - opex.subtotal;
    const profitBeforeTax = operatingProfit + otherIncome.subtotal - otherExpense.subtotal;
    const netProfit = profitBeforeTax - taxExpense.subtotal;

    return {
        revenue,
        contraRevenue,
        cogs,
        grossProfit,
        opex,
        operatingProfit,
        otherIncome,
        otherExpense,
        profitBeforeTax,
        taxExpense,
        netProfit,
        range: tb.range,
    };
}

// ---------------------------------------------------------------------------
// Balance Sheet (Neraca)
// ---------------------------------------------------------------------------
export async function getBalanceSheet(opts: AsOf = {}): Promise<{
    assets: ProfitLossSection;
    liabilities: ProfitLossSection;
    equity: ProfitLossSection;
    /** Profit YTD (sum of revenue - expenses up to asOf). Goes into equity. */
    retainedEarningsYtd: number;
    totalLiabilitiesAndEquity: number;
    balanced: boolean;
    asOf: string;
    book: LedgerBook;
}> {
    const asOf = opts.asOf ?? new Date();
    const book = (opts.book ?? "PLATFORM") as LedgerBook;
    const tb = await getTrialBalance({ to: asOf, book });

    const mk = (label: string, cls: string): ProfitLossSection => {
        const rows = tb.rows.filter((r) => r.class === cls);
        return { label, rows, subtotal: rows.reduce((s, r) => s + r.balance, 0) };
    };

    const assets = mk("Aset", "ASSET");
    const liabilities = mk("Liabilitas", "LIABILITY");
    const equity = mk("Ekuitas", "EQUITY");

    // Retained earnings YTD = revenue - contra - cogs - opex + other_income - other_expense - tax
    const pl = await getProfitLoss({ to: asOf, book });
    const retainedEarningsYtd = pl.netProfit;

    const totalLiabilitiesAndEquity =
        liabilities.subtotal + equity.subtotal + retainedEarningsYtd;

    return {
        assets,
        liabilities,
        equity,
        retainedEarningsYtd,
        totalLiabilitiesAndEquity,
        balanced: Math.abs(assets.subtotal - totalLiabilitiesAndEquity) < 0.01,
        asOf: asOf.toISOString(),
        book,
    };
}

// ---------------------------------------------------------------------------
// GL detail per account
// ---------------------------------------------------------------------------
export interface GlLineRow {
    journalId: string;
    journalNo: string;
    postedAt: string;
    description: string;
    refType: string | null;
    refId: string | null;
    debit: number;
    credit: number;
    runningBalance: number;
    memo: string | null;
}

export async function getGlForAccount(input: {
    accountCode: string;
    from?: Date;
    to?: Date;
    book?: LedgerBook;
}): Promise<{
    account: { code: string; name: string; class: string; normalBalance: string } | null;
    rows: GlLineRow[];
    openingBalance: number;
    closingBalance: number;
}> {
    const book = (input.book ?? "PLATFORM") as LedgerBook;
    const account = await db.query.coa_accounts.findFirst({
        where: eq(coa_accounts.code, input.accountCode),
        columns: { id: true, code: true, name: true, class: true, normal_balance: true },
    });
    if (!account) return { account: null, rows: [], openingBalance: 0, closingBalance: 0 };

    // Opening balance = sum before `from` (if from given)
    let opening = 0;
    if (input.from) {
        const opRows = await db
            .select({
                debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
                credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
            })
            .from(journal_lines)
            .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
            .where(
                and(
                    eq(journal_lines.account_id, account.id),
                    eq(journals.status, "POSTED"),
                    eq(journals.book, book),
                    sql`${journals.posted_at} < ${input.from}`
                )
            );
        const o = opRows[0];
        const d = toN(o?.debit);
        const c = toN(o?.credit);
        const net = d - c;
        opening = account.normal_balance === "DEBIT" ? net : -net;
    }

    const conditions = [
        eq(journal_lines.account_id, account.id),
        eq(journals.status, "POSTED"),
        eq(journals.book, book),
    ];
    if (input.from) conditions.push(gte(journals.posted_at, input.from));
    if (input.to) conditions.push(lte(journals.posted_at, input.to));

    const lines = await db
        .select({
            journalId: journals.id,
            journalNo: journals.journal_no,
            postedAt: journals.posted_at,
            description: journals.description,
            refType: journals.ref_type,
            refId: journals.ref_id,
            debit: journal_lines.debit,
            credit: journal_lines.credit,
            memo: journal_lines.memo,
        })
        .from(journal_lines)
        .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
        .where(and(...conditions))
        .orderBy(asc(journals.posted_at), asc(journals.journal_no));

    let running = opening;
    const rows: GlLineRow[] = lines.map((l) => {
        const d = toN(l.debit);
        const c = toN(l.credit);
        const delta = account.normal_balance === "DEBIT" ? d - c : c - d;
        running += delta;
        return {
            journalId: l.journalId,
            journalNo: l.journalNo,
            postedAt: l.postedAt.toISOString(),
            description: l.description,
            refType: l.refType,
            refId: l.refId,
            debit: d,
            credit: c,
            runningBalance: running,
            memo: l.memo,
        };
    });

    return {
        account: {
            code: account.code,
            name: account.name,
            class: account.class,
            normalBalance: account.normal_balance,
        },
        rows,
        openingBalance: opening,
        closingBalance: running,
    };
}

// ---------------------------------------------------------------------------
// Seller tier-1 reports — read sales_register filtered by sellerId
// ---------------------------------------------------------------------------
export interface SellerSalesSummary {
    sellerId: string;
    range: { from?: string; to?: string };
    counts: { sales: number; refunds: number };
    totals: {
        gross: number;
        discount: number;
        shipping: number;
        platformFee: number;
        sellerNet: number;
        affiliateCommission: number;
    };
    refunds: {
        gross: number;
        sellerNet: number;
    };
    netRevenue: number; // gross - refunds.gross
    netPayoutEligible: number; // sellerNet - refunds.sellerNet
}

export async function getSellerSalesSummary(input: {
    sellerId: string;
    from?: Date;
    to?: Date;
}): Promise<SellerSalesSummary> {
    const conditions = [eq(sales_register.seller_id, input.sellerId)];
    if (input.from) conditions.push(gte(sales_register.event_at, input.from));
    if (input.to) conditions.push(lte(sales_register.event_at, input.to));

    const rows = await db
        .select({
            event: sales_register.event,
            cnt: sql<string>`count(*)`,
            gross: sql<string>`coalesce(sum(${sales_register.gross}::numeric), 0)`,
            discount: sql<string>`coalesce(sum(${sales_register.discount}::numeric), 0)`,
            shipping: sql<string>`coalesce(sum(${sales_register.shipping}::numeric), 0)`,
            platformFee: sql<string>`coalesce(sum(${sales_register.platform_fee}::numeric), 0)`,
            sellerNet: sql<string>`coalesce(sum(${sales_register.seller_net}::numeric), 0)`,
            affiliateCommission: sql<string>`coalesce(sum(${sales_register.affiliate_commission}::numeric), 0)`,
        })
        .from(sales_register)
        .where(and(...conditions))
        .groupBy(sales_register.event);

    const sale = rows.find((r) => r.event === "SALE");
    const refund = rows.find((r) => r.event === "REFUND");

    const grossSale = toN(sale?.gross);
    const sellerNetSale = toN(sale?.sellerNet);
    const grossRefund = toN(refund?.gross);
    const sellerNetRefund = toN(refund?.sellerNet);

    return {
        sellerId: input.sellerId,
        range: {
            from: input.from?.toISOString(),
            to: input.to?.toISOString(),
        },
        counts: {
            sales: Number(sale?.cnt ?? 0),
            refunds: Number(refund?.cnt ?? 0),
        },
        totals: {
            gross: grossSale,
            discount: toN(sale?.discount),
            shipping: toN(sale?.shipping),
            platformFee: toN(sale?.platformFee),
            sellerNet: sellerNetSale,
            affiliateCommission: toN(sale?.affiliateCommission),
        },
        refunds: {
            gross: grossRefund,
            sellerNet: sellerNetRefund,
        },
        netRevenue: grossSale - grossRefund,
        netPayoutEligible: sellerNetSale - sellerNetRefund,
    };
}

export interface SellerSalesDetailRow {
    id: string;
    eventAt: string;
    event: string;
    orderId: string;
    orderItemId: string;
    sku: string | null;
    qty: number;
    unitPrice: number;
    gross: number;
    discount: number;
    shipping: number;
    platformFee: number;
    sellerNet: number;
    affiliateCommission: number;
    saleKind: string;
}

export async function getSellerSalesDetail(input: {
    sellerId: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}): Promise<{ rows: SellerSalesDetailRow[]; total: number }> {
    const conditions = [eq(sales_register.seller_id, input.sellerId)];
    if (input.from) conditions.push(gte(sales_register.event_at, input.from));
    if (input.to) conditions.push(lte(sales_register.event_at, input.to));

    const limit = Math.min(Math.max(input.limit ?? 100, 1), 1000);
    const offset = Math.max(input.offset ?? 0, 0);

    const [rows, totalRows] = await Promise.all([
        db
            .select({
                id: sales_register.id,
                eventAt: sales_register.event_at,
                event: sales_register.event,
                orderId: sales_register.order_id,
                orderItemId: sales_register.order_item_id,
                sku: sales_register.sku,
                qty: sales_register.qty,
                unitPrice: sales_register.unit_price,
                gross: sales_register.gross,
                discount: sales_register.discount,
                shipping: sales_register.shipping,
                platformFee: sales_register.platform_fee,
                sellerNet: sales_register.seller_net,
                affiliateCommission: sales_register.affiliate_commission,
                saleKind: sales_register.sale_kind,
            })
            .from(sales_register)
            .where(and(...conditions))
            .orderBy(desc(sales_register.event_at))
            .limit(limit)
            .offset(offset),
        db
            .select({ count: sql<string>`count(*)` })
            .from(sales_register)
            .where(and(...conditions)),
    ]);

    return {
        rows: rows.map((r) => ({
            id: r.id,
            eventAt: r.eventAt.toISOString(),
            event: r.event,
            orderId: r.orderId,
            orderItemId: r.orderItemId,
            sku: r.sku,
            qty: toN(r.qty),
            unitPrice: toN(r.unitPrice),
            gross: toN(r.gross),
            discount: toN(r.discount),
            shipping: toN(r.shipping),
            platformFee: toN(r.platformFee),
            sellerNet: toN(r.sellerNet),
            affiliateCommission: toN(r.affiliateCommission),
            saleKind: r.saleKind,
        })),
        total: Number(totalRows[0]?.count ?? 0),
    };
}

// ---------------------------------------------------------------------------
// Cash Flow Statement (Laporan Arus Kas) — PSAK 2 Direct Method
// ---------------------------------------------------------------------------

/**
 * Cash flow statement using the Direct Method.
 *
 * Cash accounts are identified by COA code prefix "11" (Kas & Setara Kas:
 * 11000-11400 — operational, escrow, payment-gateway holding, petty cash).
 *
 * Movements are bucketed by `journals.ref_type`:
 *   OPERATING:
 *     ORDER_PAYMENT                — receipts from customers (gross)
 *     ORDER_RELEASE / ORDER_ITEM   — order completion settlements
 *     ORDER_REFUND_PAID            — cash refunds to customers
 *     ORDER_REFUND                 — refund accruals (no cash if non-cash leg only)
 *     PAYOUT                       — cash payments to sellers
 *     FEE_*                        — platform fee receipts
 *     AFFILIATE_PAYMENT            — cash payments to affiliates
 *     AFFILIATE_ACCRUAL/REVERSE    — non-cash; included only if cash leg present
 *   INVESTING:
 *     ASSET_PURCHASE / ASSET_DISPOSAL (when emitted)
 *   FINANCING:
 *     LOAN_DRAW / LOAN_REPAY / EQUITY_INJECT / DIVIDEND (when emitted)
 *   OTHER (manual or unclassified):
 *     null ref_type → "MANUAL_ADJUSTMENT" (operating by default)
 */

export type CashFlowSection = "OPERATING" | "INVESTING" | "FINANCING";

const REFTYPE_TO_SECTION: Record<string, CashFlowSection> = {
    ORDER_PAYMENT: "OPERATING",
    ORDER_RELEASE: "OPERATING",
    ORDER_ITEM: "OPERATING",
    ORDER_REFUND: "OPERATING",
    ORDER_REFUND_PAID: "OPERATING",
    PAYOUT: "OPERATING",
    AFFILIATE_ACCRUAL: "OPERATING",
    AFFILIATE_PAYMENT: "OPERATING",
    AFFILIATE_REVERSE: "OPERATING",
    ASSET_PURCHASE: "INVESTING",
    ASSET_DISPOSAL: "INVESTING",
    LOAN_DRAW: "FINANCING",
    LOAN_REPAY: "FINANCING",
    EQUITY_INJECT: "FINANCING",
    DIVIDEND: "FINANCING",
};

function classifyRefType(refType: string | null): { section: CashFlowSection; bucket: string } {
    if (!refType) return { section: "OPERATING", bucket: "MANUAL_ADJUSTMENT" };
    if (refType.startsWith("FEE_")) return { section: "OPERATING", bucket: refType };
    return { section: REFTYPE_TO_SECTION[refType] ?? "OPERATING", bucket: refType };
}

export interface CashFlowLine {
    bucket: string;
    inflow: number;
    outflow: number;
    net: number;
}

export interface CashFlowSectionTotal {
    section: CashFlowSection;
    label: string;
    lines: CashFlowLine[];
    inflow: number;
    outflow: number;
    net: number;
}

export interface CashFlowReport {
    sections: CashFlowSectionTotal[];
    netCashChange: number;
    openingCash: number;
    closingCash: number;
    /** Cross-check: openingCash + netCashChange should equal closingCash. */
    reconciled: boolean;
    range: { from?: string; to?: string; book: LedgerBook };
}

const SECTION_LABELS: Record<CashFlowSection, string> = {
    OPERATING: "Arus Kas Aktivitas Operasi",
    INVESTING: "Arus Kas Aktivitas Investasi",
    FINANCING: "Arus Kas Aktivitas Pendanaan",
};

export async function getCashFlow(opts: DateRange = {}): Promise<CashFlowReport> {
    const book = (opts.book ?? "PLATFORM") as LedgerBook;

    // 1. Fetch all journal lines that hit a cash account (code starts with '11')
    //    in the period, joined with journal ref_type.
    const conds = [eq(journals.status, "POSTED"), eq(journals.book, book)];
    if (opts.from) conds.push(gte(journals.posted_at, opts.from));
    if (opts.to) conds.push(lte(journals.posted_at, opts.to));

    const rows = await db
        .select({
            refType: journals.ref_type,
            debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
            credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
        })
        .from(journal_lines)
        .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
        .innerJoin(coa_accounts, eq(coa_accounts.id, journal_lines.account_id))
        .where(and(...conds, sql`${coa_accounts.code} LIKE '11%'`))
        .groupBy(journals.ref_type);

    // 2. Bucket each (refType → section).
    const bucketMap = new Map<CashFlowSection, Map<string, CashFlowLine>>([
        ["OPERATING", new Map()],
        ["INVESTING", new Map()],
        ["FINANCING", new Map()],
    ]);
    for (const r of rows) {
        const debit = toN(r.debit);
        const credit = toN(r.credit);
        const inflow = debit; // cash account debit = inflow
        const outflow = credit; // cash account credit = outflow
        const net = inflow - outflow;
        const { section, bucket } = classifyRefType(r.refType);
        const sectionMap = bucketMap.get(section)!;
        const existing = sectionMap.get(bucket);
        if (existing) {
            existing.inflow += inflow;
            existing.outflow += outflow;
            existing.net += net;
        } else {
            sectionMap.set(bucket, { bucket, inflow, outflow, net });
        }
    }

    const sections: CashFlowSectionTotal[] = (
        ["OPERATING", "INVESTING", "FINANCING"] as CashFlowSection[]
    ).map((s) => {
        const lines = Array.from(bucketMap.get(s)!.values()).sort((a, b) =>
            a.bucket.localeCompare(b.bucket)
        );
        const inflow = lines.reduce((acc, l) => acc + l.inflow, 0);
        const outflow = lines.reduce((acc, l) => acc + l.outflow, 0);
        return {
            section: s,
            label: SECTION_LABELS[s],
            lines,
            inflow,
            outflow,
            net: inflow - outflow,
        };
    });

    const netCashChange = sections.reduce((acc, s) => acc + s.net, 0);

    // 3. Opening & closing cash: sum cash account net debits up to from/to.
    async function cashBalanceAsOf(asOf?: Date): Promise<number> {
        const c = [eq(journals.status, "POSTED"), eq(journals.book, book)];
        if (asOf) c.push(lte(journals.posted_at, asOf));
        const rs = await db
            .select({
                debit: sql<string>`coalesce(sum(${journal_lines.debit}::numeric), 0)`,
                credit: sql<string>`coalesce(sum(${journal_lines.credit}::numeric), 0)`,
            })
            .from(journal_lines)
            .innerJoin(journals, eq(journals.id, journal_lines.journal_id))
            .innerJoin(coa_accounts, eq(coa_accounts.id, journal_lines.account_id))
            .where(and(...c, sql`${coa_accounts.code} LIKE '11%'`));
        const d = toN(rs[0]?.debit ?? "0");
        const cr = toN(rs[0]?.credit ?? "0");
        return d - cr;
    }

    const openingCash = opts.from
        ? await cashBalanceAsOf(new Date(opts.from.getTime() - 1))
        : 0;
    const closingCash = await cashBalanceAsOf(opts.to);

    return {
        sections,
        netCashChange,
        openingCash,
        closingCash,
        reconciled: Math.abs(openingCash + netCashChange - closingCash) < 0.01,
        range: {
            from: opts.from?.toISOString(),
            to: opts.to?.toISOString(),
            book,
        },
    };
}


