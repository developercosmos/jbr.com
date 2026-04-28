"use server";

/**
 * Auto-posting helpers for business events (Phase 2).
 *
 * Each helper is a thin wrapper that:
 *   1. Builds the canonical journal-line array for a known business event
 *   2. Calls postJournal() with a deterministic idempotency_key
 *   3. Optionally writes a sales_register row in the same logical step
 *
 * All amounts are in IDR (entity.base_currency) unless overridden.
 *
 * Tickets: GL-03 (postOrderPayment), GL-14 (sales_register write inside
 * postOrderRelease), GL-12 (affiliate trio), plus postOrderRefund / postPayout
 * / postFee.
 */

import { db } from "@/db";
import { sales_register } from "@/db/schema";
import { postJournal, type PostJournalResult, type JournalLineInput } from "./journals";
import { getSetting } from "./settings";
import { r2, deriveFeeTax } from "./posting-internal";

// ---------------------------------------------------------------------------
// Internal helpers (pure r2/deriveFeeTax live in ./posting-internal so this
// "use server" module only exports async functions, per Next.js requirement).
// ---------------------------------------------------------------------------

interface TaxContext {
    isPkp: boolean;
    ppnRate: number;
    ppnMethod: "INCLUSIVE" | "EXCLUSIVE";
}

async function loadTaxContext(at?: Date): Promise<TaxContext> {
    const [isPkp, ppnRate, ppnMethod] = await Promise.all([
        getSetting<boolean>("entity.is_pkp", { at, defaultValue: false }),
        getSetting<number>("tax.ppn_rate", { at, defaultValue: 0.11 }),
        getSetting<"INCLUSIVE" | "EXCLUSIVE">("tax.ppn_method", {
            at,
            defaultValue: "INCLUSIVE",
        }),
    ]);
    return { isPkp: !!isPkp, ppnRate: Number(ppnRate ?? 0.11), ppnMethod: ppnMethod ?? "INCLUSIVE" };
}

// ===========================================================================
// GL-03  postOrderPayment — Buyer paid (Xendit PAID webhook)
// ===========================================================================
//
// Journal:
//   DR 11300 Kas di Payment Gateway        (gross)
//   CR 23000 Pendapatan Diterima di Muka   (gross)
//
// Fee MDR (jika diketahui dari webhook) — biasanya di-net oleh Xendit pada
// settlement. Untuk sekarang full gross masuk, MDR dijurnal terpisah saat
// settlement bank statement (Phase 3 reconciliation).
// ===========================================================================
export interface PostOrderPaymentInput {
    orderId: string;
    paymentId: string;
    grossAmount: number;
    paidAt?: Date;
    paymentMethod?: string | null;
}

export async function postOrderPayment(
    input: PostOrderPaymentInput
): Promise<PostJournalResult> {
    const gross = r2(input.grossAmount);
    if (gross <= 0) throw new Error("postOrderPayment: grossAmount must be > 0");

    return postJournal({
        source: "AUTO_PAYMENT",
        description: `Buyer payment received — order ${input.orderId}`,
        refType: "ORDER_PAYMENT",
        refId: input.paymentId,
        idempotencyKey: `ORDER_PAYMENT:${input.orderId}:${input.paymentId}`,
        postedAt: input.paidAt,
        lines: [
            {
                accountCode: "11300",
                debit: gross,
                memo: `Kas PG (${input.paymentMethod ?? "Xendit"})`,
            },
            {
                accountCode: "23000",
                credit: gross,
                memo: "Escrow buyer (deferred revenue)",
                partnerUserId: null,
            },
        ],
    });
}

// ===========================================================================
// GL-14  postOrderRelease — Order COMPLETED, escrow released
// ===========================================================================
//
// Journal (gross = item subtotal + shipping; platformFee carved out of seller share):
//   DR 23000 Escrow / Pendapatan Diterima di Muka   (grossPaid)
//   CR 22000 Utang ke Seller (Wallet)               (sellerNet, partner=sellerId)
//   CR 41000 Pendapatan Komisi Marketplace          (feeDpp)
//   CR 24100 PPN Keluaran                           (feePpn, jika PKP)
//
// Plus sales_register row per order_item.
// ===========================================================================
export interface OrderReleaseItem {
    orderItemId: string;
    productId?: string | null;
    variantId?: string | null;
    sku?: string | null;
    categoryId?: string | null;
    qty: number;
    unitPrice: number;
    /** Item gross before fee (qty * unitPrice net of item-level discount). */
    gross: number;
    /** Discount applied at item level. */
    discount?: number;
    /** Shipping subsidy or charge attributable to this item. */
    shipping?: number;
    /** Platform fee already snapshotted (resolved_fee_value). */
    platformFee: number;
    /** Affiliate commission for this item, if any. */
    affiliateCommission?: number;
    affiliateUserId?: string | null;
    saleKind?: "AGENT_3P" | "PRINCIPAL_1P";
}

export interface PostOrderReleaseInput {
    orderId: string;
    sellerId: string;
    buyerId?: string | null;
    grossPaid: number;
    items: OrderReleaseItem[];
    completedAt?: Date;
}

export async function postOrderRelease(
    input: PostOrderReleaseInput
): Promise<PostJournalResult> {
    const grossPaid = r2(input.grossPaid);
    if (grossPaid <= 0) throw new Error("postOrderRelease: grossPaid must be > 0");
    if (!input.items?.length) throw new Error("postOrderRelease: items required");

    const tax = await loadTaxContext(input.completedAt);

    let totalFeeGross = 0;
    let totalFeeDpp = 0;
    let totalFeePpn = 0;
    const itemFeeBreakdown: Array<{
        item: OrderReleaseItem;
        feeGross: number;
        feeDpp: number;
        feePpn: number;
        sellerNet: number;
    }> = [];

    for (const item of input.items) {
        const feeGross = r2(item.platformFee || 0);
        const { dpp, ppn } = deriveFeeTax(feeGross, tax.ppnRate, tax.ppnMethod, tax.isPkp);
        const itemGross = r2(item.gross);
        const sellerNet = r2(itemGross - feeGross);
        totalFeeGross += feeGross;
        totalFeeDpp += dpp;
        totalFeePpn += ppn;
        itemFeeBreakdown.push({ item, feeGross, feeDpp: dpp, feePpn: ppn, sellerNet });
    }
    totalFeeGross = r2(totalFeeGross);
    totalFeeDpp = r2(totalFeeDpp);
    totalFeePpn = r2(totalFeePpn);
    const sellerNetTotal = r2(grossPaid - totalFeeGross);

    const lines: JournalLineInput[] = [
        {
            accountCode: "23000",
            debit: grossPaid,
            memo: `Release escrow order ${input.orderId}`,
        },
        {
            accountCode: "22000",
            credit: sellerNetTotal,
            memo: `Net to seller wallet`,
            partnerUserId: input.sellerId,
            partnerRole: "SELLER",
        },
    ];
    if (totalFeeDpp > 0) {
        lines.push({
            accountCode: "41000",
            credit: totalFeeDpp,
            memo: "Komisi marketplace (DPP)",
        });
    }
    if (totalFeePpn > 0) {
        lines.push({
            accountCode: "24100",
            credit: totalFeePpn,
            memo: "PPN Keluaran atas komisi",
        });
    }

    const result = await postJournal({
        source: "AUTO_ORDER",
        description: `Order release — ${input.orderId}`,
        refType: "ORDER_RELEASE",
        refId: input.orderId,
        idempotencyKey: `ORDER_RELEASE:${input.orderId}`,
        postedAt: input.completedAt,
        lines,
    });

    // Sales register write (idempotent via unique(order_item_id, event)).
    if (!result.alreadyExisted) {
        for (const row of itemFeeBreakdown) {
            try {
                await db
                    .insert(sales_register)
                    .values({
                        journal_id: result.journalId,
                        order_id: input.orderId,
                        order_item_id: row.item.orderItemId,
                        event: "SALE",
                        seller_id: input.sellerId,
                        buyer_id: input.buyerId ?? null,
                        product_id: row.item.productId ?? null,
                        variant_id: row.item.variantId ?? null,
                        sku: row.item.sku ?? null,
                        category_id: row.item.categoryId ?? null,
                        qty: String(row.item.qty),
                        unit_price: r2(row.item.unitPrice).toFixed(2),
                        gross: r2(row.item.gross).toFixed(2),
                        discount: r2(row.item.discount || 0).toFixed(2),
                        shipping: r2(row.item.shipping || 0).toFixed(2),
                        platform_fee: row.feeGross.toFixed(2),
                        fee_dpp: row.feeDpp.toFixed(2),
                        fee_ppn: row.feePpn.toFixed(2),
                        seller_net: row.sellerNet.toFixed(2),
                        affiliate_user_id: row.item.affiliateUserId ?? null,
                        affiliate_commission: r2(row.item.affiliateCommission || 0).toFixed(2),
                        sale_kind: row.item.saleKind ?? "AGENT_3P",
                        currency: "IDR",
                    })
                    .onConflictDoNothing();
            } catch {
                // Sales register write is best-effort — never block journal flow.
            }
        }
    }

    return result;
}

// ===========================================================================
// postOrderRefund — Full or partial refund to buyer
// ===========================================================================
//
// Two-step model (refund is "obligated" then "disbursed"):
//
// Step 1 (obligation, called when refund decided):
//   DR 23000 Escrow                       (refundAmount)   — release from escrow
//   CR 22100 Utang Refund ke Buyer        (refundAmount)
//
// Step 2 (disbursement, called when actually paid out — usually matched
// during bank reconciliation, optional in Phase 2):
//   DR 22100 Utang Refund                 (refundAmount)
//   CR 11100 Kas Operasional              (refundAmount)
//
// For Phase 2 we collapse to step 1 only via `postOrderRefund` and expose
// `postOrderRefundDisbursement` for the cash-out leg.
// ===========================================================================
export interface PostOrderRefundInput {
    orderId: string;
    refundId: string;
    amount: number;
    /** REFUND or partial REFUND row in sales_register. */
    orderItemId?: string;
    refundedAt?: Date;
}

export async function postOrderRefund(
    input: PostOrderRefundInput
): Promise<PostJournalResult> {
    const amount = r2(input.amount);
    if (amount <= 0) throw new Error("postOrderRefund: amount must be > 0");
    return postJournal({
        source: "AUTO_REFUND",
        description: `Refund obligation — order ${input.orderId}`,
        refType: "ORDER_REFUND",
        refId: input.refundId,
        idempotencyKey: `ORDER_REFUND:${input.refundId}`,
        postedAt: input.refundedAt,
        lines: [
            { accountCode: "23000", debit: amount, memo: "Release escrow → refund" },
            { accountCode: "22100", credit: amount, memo: "Utang refund ke buyer" },
        ],
    });
}

export async function postOrderRefundDisbursement(input: {
    refundId: string;
    amount: number;
    disbursedAt?: Date;
}): Promise<PostJournalResult> {
    const amount = r2(input.amount);
    if (amount <= 0) throw new Error("postOrderRefundDisbursement: amount must be > 0");
    return postJournal({
        source: "AUTO_REFUND",
        description: `Refund disbursed — ${input.refundId}`,
        refType: "ORDER_REFUND_PAID",
        refId: input.refundId,
        idempotencyKey: `ORDER_REFUND_PAID:${input.refundId}`,
        postedAt: input.disbursedAt,
        lines: [
            { accountCode: "22100", debit: amount, memo: "Settle refund obligation" },
            { accountCode: "11100", credit: amount, memo: "Cash out from operating bank" },
        ],
    });
}

// ===========================================================================
// postPayout — Seller withdraws wallet balance
// ===========================================================================
//
//   DR 22000 Utang ke Seller (wallet)     (payoutNet, partner=sellerId)
//   DR 65100 Beban Bank (transfer fee)    (bankFee, optional)
//   CR 11100 Kas Operasional              (payoutNet + bankFee)
// ===========================================================================
export interface PostPayoutInput {
    payoutId: string;
    sellerId: string;
    amount: number;
    bankFee?: number;
    paidAt?: Date;
}

export async function postPayout(input: PostPayoutInput): Promise<PostJournalResult> {
    const amount = r2(input.amount);
    if (amount <= 0) throw new Error("postPayout: amount must be > 0");
    const bankFee = r2(input.bankFee || 0);
    const totalCash = r2(amount + bankFee);

    const lines: JournalLineInput[] = [
        {
            accountCode: "22000",
            debit: amount,
            memo: `Payout to seller`,
            partnerUserId: input.sellerId,
            partnerRole: "SELLER",
        },
    ];
    if (bankFee > 0) {
        lines.push({
            accountCode: "65100",
            debit: bankFee,
            memo: "Bank transfer fee",
        });
    }
    lines.push({
        accountCode: "11100",
        credit: totalCash,
        memo: "Cash out from operating bank",
    });

    return postJournal({
        source: "AUTO_PAYOUT",
        description: `Seller payout — ${input.payoutId}`,
        refType: "PAYOUT",
        refId: input.payoutId,
        idempotencyKey: `PAYOUT:${input.payoutId}`,
        postedAt: input.paidAt,
        lines,
    });
}

// ===========================================================================
// postFee — Platform fee revenue (listing / iklan / subscription)
// ===========================================================================
//
//   DR 11100 Kas Operasional (or 12100 Piutang)   (gross)
//   CR 4xxxx Pendapatan Fee                       (DPP)
//   CR 24100 PPN Keluaran                         (PPN, jika PKP)
// ===========================================================================
export type FeeKind = "LISTING" | "PROMOTED" | "SUBSCRIPTION" | "CONVENIENCE";
const FEE_REVENUE_ACCOUNT: Record<FeeKind, string> = {
    LISTING: "41100",
    PROMOTED: "41200",
    SUBSCRIPTION: "41300",
    CONVENIENCE: "41500",
};

export interface PostFeeInput {
    feeId: string;
    kind: FeeKind;
    sellerId?: string;
    amount: number;
    paid?: boolean; // true → DR 11100 Kas; false → DR 12100 Piutang
    chargedAt?: Date;
}

export async function postFee(input: PostFeeInput): Promise<PostJournalResult> {
    const gross = r2(input.amount);
    if (gross <= 0) throw new Error("postFee: amount must be > 0");
    const tax = await loadTaxContext(input.chargedAt);
    const { dpp, ppn } = deriveFeeTax(gross, tax.ppnRate, tax.ppnMethod, tax.isPkp);
    const debitAccount = input.paid === false ? "12100" : "11100";

    const lines: JournalLineInput[] = [
        {
            accountCode: debitAccount,
            debit: gross,
            memo: `Fee ${input.kind}`,
            partnerUserId: input.sellerId ?? null,
            partnerRole: input.sellerId ? "SELLER" : null,
        },
        {
            accountCode: FEE_REVENUE_ACCOUNT[input.kind],
            credit: dpp,
            memo: `Pendapatan ${input.kind}`,
        },
    ];
    if (ppn > 0) {
        lines.push({
            accountCode: "24100",
            credit: ppn,
            memo: "PPN Keluaran atas fee",
        });
    }

    return postJournal({
        source: "AUTO_FEE",
        description: `Platform fee ${input.kind} — ${input.feeId}`,
        refType: `FEE_${input.kind}`,
        refId: input.feeId,
        idempotencyKey: `FEE:${input.kind}:${input.feeId}`,
        postedAt: input.chargedAt,
        lines,
    });
}

// ===========================================================================
// GL-12  Affiliate commission trio
// ===========================================================================
//
// 1) Accrual (commission earned but not yet paid):
//      DR 66000 Beban Komisi Affiliate         (commission)
//      CR 22200 Utang Komisi Affiliate         (commission, partner=affiliate)
//
// 2) Payment (cash out to affiliate, optional withholding):
//      DR 22200 Utang Komisi Affiliate         (commissionGross, partner=aff)
//      CR 11100 Kas Operasional                (commissionGross - withholding)
//      CR 24200 PPh 23 Terutang                (withholding, if PPH_23)
//
// 3) Reverse / clawback (e.g., refund pulled the underlying order):
//      DR 22200 Utang Komisi Affiliate         (commission)
//      CR 66000 Beban Komisi Affiliate         (commission)
// ===========================================================================
export interface PostAffiliateAccrualInput {
    attributionId: string;
    affiliateUserId: string;
    orderId?: string;
    commission: number;
    accruedAt?: Date;
}

export async function postAffiliateCommissionAccrual(
    input: PostAffiliateAccrualInput
): Promise<PostJournalResult> {
    const amount = r2(input.commission);
    if (amount <= 0) throw new Error("postAffiliateCommissionAccrual: commission must be > 0");
    return postJournal({
        source: "AUTO_AFFILIATE",
        description: `Affiliate commission accrual — ${input.attributionId}`,
        refType: "AFFILIATE_ACCRUAL",
        refId: input.attributionId,
        idempotencyKey: `AFF_ACCRUAL:${input.attributionId}`,
        postedAt: input.accruedAt,
        lines: [
            { accountCode: "66000", debit: amount, memo: "Beban komisi affiliate" },
            {
                accountCode: "22200",
                credit: amount,
                memo: "Utang komisi affiliate",
                partnerUserId: input.affiliateUserId,
                partnerRole: "AFFILIATE",
            },
        ],
    });
}

export interface PostAffiliatePaymentInput {
    payoutId: string;
    affiliateUserId: string;
    grossCommission: number;
    /** PPh 23 withholding (2% if affiliate is corporate). 0 by default. */
    withholding?: number;
    /** Tax kind for the withholding line, default PPH_23. */
    withholdingKind?: "PPH_23" | "PPH_21" | "PPH_4_2";
    paidAt?: Date;
}

export async function postAffiliatePayment(
    input: PostAffiliatePaymentInput
): Promise<PostJournalResult> {
    const gross = r2(input.grossCommission);
    if (gross <= 0) throw new Error("postAffiliatePayment: grossCommission must be > 0");
    const wh = r2(input.withholding || 0);
    const cash = r2(gross - wh);
    if (cash < 0) throw new Error("postAffiliatePayment: withholding exceeds gross");

    const lines: JournalLineInput[] = [
        {
            accountCode: "22200",
            debit: gross,
            memo: "Settle commission payable",
            partnerUserId: input.affiliateUserId,
            partnerRole: "AFFILIATE",
        },
        { accountCode: "11100", credit: cash, memo: "Cash out to affiliate" },
    ];
    if (wh > 0) {
        const whAccount =
            input.withholdingKind === "PPH_21"
                ? "24300"
                : input.withholdingKind === "PPH_4_2"
                  ? "24400"
                  : "24200";
        lines.push({
            accountCode: whAccount,
            credit: wh,
            memo: `Pemotongan ${input.withholdingKind ?? "PPH_23"}`,
        });
    }

    return postJournal({
        source: "AUTO_AFFILIATE",
        description: `Affiliate payout — ${input.payoutId}`,
        refType: "AFFILIATE_PAYMENT",
        refId: input.payoutId,
        idempotencyKey: `AFF_PAYMENT:${input.payoutId}`,
        postedAt: input.paidAt,
        lines,
    });
}

export async function postAffiliateCommissionReverse(input: {
    attributionId: string;
    affiliateUserId: string;
    commission: number;
    reversedAt?: Date;
}): Promise<PostJournalResult> {
    const amount = r2(input.commission);
    if (amount <= 0) throw new Error("postAffiliateCommissionReverse: commission must be > 0");
    return postJournal({
        source: "AUTO_AFFILIATE",
        description: `Affiliate commission reversal — ${input.attributionId}`,
        refType: "AFFILIATE_REVERSE",
        refId: input.attributionId,
        idempotencyKey: `AFF_REVERSE:${input.attributionId}`,
        postedAt: input.reversedAt,
        lines: [
            {
                accountCode: "22200",
                debit: amount,
                memo: "Reverse commission payable",
                partnerUserId: input.affiliateUserId,
                partnerRole: "AFFILIATE",
            },
            { accountCode: "66000", credit: amount, memo: "Reverse commission expense" },
        ],
    });
}

// ---------------------------------------------------------------------------
// Internal exports for tests are NOT allowed in "use server" files. Tests
// import the pure helpers directly from ./posting-internal.
// ---------------------------------------------------------------------------
