"use server";

import { db } from "@/db";
import { notifications, users, sellerPayouts } from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { postPayout } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { getT0Gates } from "@/actions/kyc";
import { getSellerLedgerSummary } from "@/actions/accounting/seller-ledger";
import { resolveBankCode } from "@/lib/bank-codes";
import { createXenditDisbursement, DisbursementError } from "@/lib/xendit-disbursement";
import { logger } from "@/lib/logger";

const recordSellerPayoutSchema = z.object({
    sellerId: z.string().min(1),
    amount: z.number().positive(),
    bankFee: z.number().min(0).optional(),
    reference: z.string().trim().max(120).optional(),
});

/**
 * Admin records a real seller payout (bank transfer already executed out-of-band).
 * Posts the GL legs (DR seller-wallet-payable 22000, CR cash 11100) so the seller's
 * payable balance in the ledger actually decreases — previously postPayout had no
 * caller, so the GL payable never went down on payouts.
 *
 * Idempotent: postPayout keys on PAYOUT:<payoutId>. The caller-supplied reference
 * (e.g. bank transfer id) is used as the payout id when given, so re-recording the
 * same transfer is a no-op.
 *
 * NOTE: this records the accounting movement only — it does not move money. The
 * actual bank transfer is an operational step. A self-serve seller withdrawal
 * request flow (request → approve → transfer → record) is a separate feature.
 */
export async function recordSellerPayout(input: z.infer<typeof recordSellerPayoutSchema>) {
    await requireAdminFinanceSession();
    const validated = recordSellerPayoutSchema.parse(input);

    const seller = await db.query.users.findFirst({
        where: eq(users.id, validated.sellerId),
        columns: { id: true, name: true, store_name: true, tier: true },
    });
    if (!seller) throw new Error("Penjual tidak ditemukan");

    // Gate T0: payout di atas batas (configurable) wajib upgrade tier ke T1 dulu.
    // Seller ikut dinotifikasi (idempoten) supaya tahu langkah yang harus diambil.
    if (seller.tier === "T0") {
        const { maxPayout } = await getT0Gates();
        if (validated.amount > maxPayout) {
            await db
                .insert(notifications)
                .values({
                    user_id: seller.id,
                    type: "SYSTEM",
                    title: "Payout Ditahan — Perlu Upgrade ke Tier T1",
                    message:
                        `Payout sebesar Rp ${validated.amount.toLocaleString("id-ID")} melebihi batas tier T0 ` +
                        `(Rp ${maxPayout.toLocaleString("id-ID")}). Lengkapi verifikasi KYC (KTP + selfie) di ` +
                        "Pengaturan Toko → Verifikasi KYC Seller untuk naik ke T1 agar payout dapat diproses. " +
                        "Bonus: toko Anda mendapat lencana ✓ Seller Terverifikasi yang meningkatkan kepercayaan pembeli.",
                    idempotency_key: `T0_PAYOUT_GATE:${seller.id}:${new Date().toISOString().slice(0, 7)}`,
                    data: { amount: validated.amount, max_payout: maxPayout },
                })
                .onConflictDoNothing();
            throw new Error(
                `Payout Rp ${validated.amount.toLocaleString("id-ID")} melebihi batas tier T0 ` +
                `(Rp ${maxPayout.toLocaleString("id-ID")}). Seller wajib naik ke T1 (KYC) sebelum payout ini ` +
                "dicatat — seller sudah dinotifikasi."
            );
        }
    }

    const payoutId = validated.reference?.trim() || randomUUID();
    await drainSellerPayoutGL({
        sellerId: validated.sellerId,
        amount: validated.amount,
        bankFee: validated.bankFee,
        reference: payoutId,
    });
    return { success: true, payoutId };
}

/**
 * GL drain for a payout whose money has ALREADY left the platform (DR 22000 /
 * CR 11100). AUTH-FREE on purpose: it's called from the Xendit disbursement
 * webhook (no admin session) and from recordSellerPayout (after its admin guard
 * + T0 gate). NO T0 gate here — the cash is already gone; blocking the books
 * would only desync them. Idempotent via postPayout key PAYOUT:<reference>.
 */
async function drainSellerPayoutGL(args: { sellerId: string; amount: number; bankFee?: number; reference: string }) {
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        await postPayout({
            payoutId: args.reference,
            sellerId: args.sellerId,
            amount: Math.floor(args.amount),
            bankFee: args.bankFee,
        });
    }
    revalidatePath("/admin/finance/seller-ledger");
}

// ============================================
// SELLER WITHDRAWAL FLOW (request → admin approve → Xendit disbursement → webhook)
// ============================================

const MIN_PAYOUT = 10_000;

async function getSellerSession() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Tidak terautentikasi");
    return session.user;
}

async function getSellerBank(sellerId: string) {
    const u = await db.query.users.findFirst({
        where: eq(users.id, sellerId),
        columns: {
            payout_bank_name: true,
            payout_bank_account_number: true,
            payout_bank_account_name: true,
        },
    });
    if (!u) return null;
    return {
        bank_name: u.payout_bank_name,
        bank_account_number: u.payout_bank_account_number,
        bank_account_name: u.payout_bank_account_name,
    };
}

/** Wallet balance (account 22000) minus amounts already reserved by in-flight payouts. */
async function availablePayoutBalance(sellerId: string): Promise<number> {
    const ledger = await getSellerLedgerSummary(sellerId);
    const reservedRows = await db
        .select({ total: sql<string>`COALESCE(SUM(${sellerPayouts.amount}), 0)` })
        .from(sellerPayouts)
        .where(and(eq(sellerPayouts.seller_id, sellerId), inArray(sellerPayouts.status, ["PENDING", "PROCESSING"])));
    const reserved = Number(reservedRows[0]?.total ?? 0);
    return Math.max(0, Math.floor(ledger.walletBalance - reserved));
}

/** Seller dashboard: available balance, bank account status, recent payouts. */
export async function getSellerPayoutInfo() {
    const user = await getSellerSession();
    const [available, kyc, payouts] = await Promise.all([
        availablePayoutBalance(user.id),
        getSellerBank(user.id),
        db.query.sellerPayouts.findMany({
            where: eq(sellerPayouts.seller_id, user.id),
            orderBy: [desc(sellerPayouts.created_at)],
            limit: 20,
        }),
    ]);
    const bankCode = resolveBankCode(kyc?.bank_name);
    return {
        available,
        minPayout: MIN_PAYOUT,
        bank: kyc?.bank_account_number
            ? {
                name: kyc.bank_name,
                accountNumber: kyc.bank_account_number,
                accountName: kyc.bank_account_name,
                resolvable: !!bankCode && !!kyc.bank_account_name,
            }
            : null,
        payouts,
    };
}

const updateBankSchema = z.object({
    bankName: z.string().trim().min(2).max(60),
    accountNumber: z.string().trim().regex(/^[0-9]{6,20}$/),
    accountName: z.string().trim().min(2).max(80),
});

/** Seller sets/updates their payout bank account (destination for disbursements). */
export async function updateSellerPayoutBank(input: z.infer<typeof updateBankSchema>) {
    try {
        const user = await getSellerSession();
        const v = updateBankSchema.parse(input);
        if (!resolveBankCode(v.bankName)) {
            return { success: false as const, error: "Nama bank tidak dikenali. Pakai nama umum (mis. BCA, BNI, BRI, Mandiri, CIMB)." };
        }
        await db
            .update(users)
            .set({
                payout_bank_name: v.bankName,
                payout_bank_account_number: v.accountNumber,
                payout_bank_account_name: v.accountName,
            })
            .where(eq(users.id, user.id));
        revalidatePath("/seller/keuangan");
        return { success: true as const };
    } catch (e) {
        return { success: false as const, error: e instanceof Error ? e.message : "Gagal menyimpan rekening." };
    }
}

const requestPayoutSchema = z.object({ amount: z.number().positive() });

/** Seller requests a withdrawal of their wallet balance. Creates a PENDING payout. */
export async function requestSellerPayout(input: z.infer<typeof requestPayoutSchema>) {
    try {
        const user = await getSellerSession();
        const amount = Math.floor(requestPayoutSchema.parse(input).amount);
        if (amount < MIN_PAYOUT) {
            return { success: false as const, error: `Minimal penarikan Rp ${MIN_PAYOUT.toLocaleString("id-ID")}.` };
        }
        const kyc = await getSellerBank(user.id);
        const bankCode = resolveBankCode(kyc?.bank_name);
        if (!kyc?.bank_account_number || !kyc.bank_account_name || !bankCode) {
            return { success: false as const, error: "Rekening bank belum lengkap / bank tidak dikenali. Lengkapi data bank Anda dulu." };
        }
        // Capture narrowed bank fields into consts — property narrowing doesn't
        // survive into the transaction closure below.
        const bankAccountNumber = kyc.bank_account_number;
        const bankAccountName = kyc.bank_account_name;
        const resolvedBankCode = bankCode;

        // Enforce the T0 payout cap HERE (at request time), not at GL drain — a
        // post-disbursement throw would desync the books and re-open a double-pay hole.
        const me = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { tier: true } });
        if (me?.tier === "T0") {
            const { maxPayout } = await getT0Gates();
            if (amount > maxPayout) {
                return {
                    success: false as const,
                    error: `Tier T0 hanya dapat menarik hingga Rp ${maxPayout.toLocaleString("id-ID")} per penarikan. Lengkapi KYC untuk naik ke T1.`,
                };
            }
        }

        // Reserve atomically: a per-seller advisory xact lock serializes concurrent
        // requests so two can't both read the same available balance and over-reserve
        // (which would let the platform disburse more than the wallet holds).
        const result = await db.transaction(async (tx) => {
            await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`);

            const ledger = await getSellerLedgerSummary(user.id); // committed wallet (22000)
            const reservedRows = await tx
                .select({ total: sql<string>`COALESCE(SUM(${sellerPayouts.amount}), 0)` })
                .from(sellerPayouts)
                .where(and(eq(sellerPayouts.seller_id, user.id), inArray(sellerPayouts.status, ["PENDING", "PROCESSING"])));
            const available = Math.max(0, Math.floor(ledger.walletBalance - Number(reservedRows[0]?.total ?? 0)));
            if (amount > available) {
                return { error: `Saldo tersedia Rp ${available.toLocaleString("id-ID")}, kurang dari jumlah penarikan.` } as const;
            }
            const [row] = await tx
                .insert(sellerPayouts)
                .values({
                    seller_id: user.id,
                    amount: amount.toString(),
                    status: "PENDING",
                    bank_code: resolvedBankCode,
                    bank_account_number: bankAccountNumber,
                    bank_account_name: bankAccountName,
                    external_id: `payout_${randomUUID()}`,
                })
                .returning({ id: sellerPayouts.id });
            return { id: row.id } as const;
        });

        if ("error" in result) return { success: false as const, error: result.error };
        revalidatePath("/seller/keuangan");
        revalidatePath("/admin/payouts");
        return { success: true as const, payoutId: result.id };
    } catch (e) {
        return { success: false as const, error: e instanceof Error ? e.message : "Gagal mengajukan penarikan." };
    }
}

/** Admin approves a PENDING payout → triggers the Xendit disbursement (PROCESSING). */
export async function approveSellerPayout(input: { payoutId: string }) {
    const admin = await requireAdminFinanceSession();
    const payout = await db.query.sellerPayouts.findFirst({ where: eq(sellerPayouts.id, input.payoutId) });
    if (!payout) return { success: false as const, error: "Penarikan tidak ditemukan." };
    if (payout.status !== "PENDING") {
        return { success: false as const, error: `Penarikan berstatus ${payout.status}, tidak bisa di-approve.` };
    }

    // Atomic claim so two admins can't double-disburse.
    const claimed = await db
        .update(sellerPayouts)
        .set({ status: "PROCESSING", approved_at: new Date(), approved_by: admin.userId, updated_at: new Date() })
        .where(and(eq(sellerPayouts.id, payout.id), eq(sellerPayouts.status, "PENDING")))
        .returning({ id: sellerPayouts.id });
    if (claimed.length === 0) return { success: false as const, error: "Penarikan sudah diproses pihak lain." };

    try {
        const result = await createXenditDisbursement({
            externalId: payout.external_id,
            bankCode: payout.bank_code,
            accountHolderName: payout.bank_account_name,
            accountNumber: payout.bank_account_number,
            amount: Number(payout.amount),
            description: `Payout JBR ${payout.external_id}`,
        });
        await db
            .update(sellerPayouts)
            .set({ xendit_disbursement_id: result.id, updated_at: new Date() })
            .where(eq(sellerPayouts.id, payout.id));
        revalidatePath("/admin/payouts");
        return { success: true as const };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Disbursement gagal.";
        // AMBIGUOUS (timeout/5xx/network): the transfer may already be in flight.
        // Keep status PROCESSING (reservation held) and let the webhook finalize —
        // releasing it now would risk a double-disbursement on re-request.
        if (e instanceof DisbursementError && e.ambiguous) {
            await db
                .update(sellerPayouts)
                .set({ failure_reason: msg, updated_at: new Date() })
                .where(eq(sellerPayouts.id, payout.id));
            logger.error("payout:disbursement_ambiguous", { payoutId: payout.id, error: msg });
            revalidatePath("/admin/payouts");
            return {
                success: false as const,
                error: `Status transfer belum pasti (${msg}). Tetap diproses — akan dikonfirmasi otomatis via webhook. Jangan approve ulang.`,
            };
        }
        // Definitive pre-submit failure → safe to mark FAILED + release reservation.
        await db
            .update(sellerPayouts)
            .set({ status: "FAILED", failure_reason: msg, updated_at: new Date() })
            .where(eq(sellerPayouts.id, payout.id));
        logger.error("payout:disbursement_failed", { payoutId: payout.id, error: msg });
        revalidatePath("/admin/payouts");
        return { success: false as const, error: msg };
    }
}

/** Admin rejects a PENDING payout (releases the reservation). */
export async function rejectSellerPayout(input: { payoutId: string; reason?: string }) {
    await requireAdminFinanceSession();
    const claimed = await db
        .update(sellerPayouts)
        .set({ status: "REJECTED", failure_reason: input.reason?.trim() || "Ditolak admin", updated_at: new Date() })
        .where(and(eq(sellerPayouts.id, input.payoutId), eq(sellerPayouts.status, "PENDING")))
        .returning({ id: sellerPayouts.id });
    if (claimed.length === 0) return { success: false as const, error: "Hanya penarikan PENDING yang bisa ditolak." };
    revalidatePath("/admin/payouts");
    return { success: true as const };
}

export async function listPayoutsForAdmin() {
    await requireAdminFinanceSession();
    return db
        .select({
            id: sellerPayouts.id,
            amount: sellerPayouts.amount,
            status: sellerPayouts.status,
            bank_code: sellerPayouts.bank_code,
            bank_account_number: sellerPayouts.bank_account_number,
            bank_account_name: sellerPayouts.bank_account_name,
            xendit_disbursement_id: sellerPayouts.xendit_disbursement_id,
            failure_reason: sellerPayouts.failure_reason,
            created_at: sellerPayouts.created_at,
            sellerName: users.name,
            sellerEmail: users.email,
        })
        .from(sellerPayouts)
        .leftJoin(users, eq(sellerPayouts.seller_id, users.id))
        .orderBy(desc(sellerPayouts.created_at))
        .limit(200);
}

/**
 * Finalize a disbursement from the Xendit webhook. Idempotent: COMPLETED drains the
 * GL wallet (recordSellerPayout keyed on external_id) exactly once; FAILED releases
 * the reservation. No-op if the payout already left PENDING/PROCESSING.
 */
export async function finalizeDisbursementWebhook(input: {
    externalId?: string;
    disbursementId?: string;
    status: string;
    failureReason?: string;
}) {
    const whereClause = input.externalId
        ? eq(sellerPayouts.external_id, input.externalId)
        : input.disbursementId
            ? eq(sellerPayouts.xendit_disbursement_id, input.disbursementId)
            : null;
    if (!whereClause) return;

    const payout = await db.query.sellerPayouts.findFirst({ where: whereClause });
    if (!payout) return;

    const status = input.status.toUpperCase();
    if (status === "COMPLETED" || status === "SETTLED") {
        const won = await db
            .update(sellerPayouts)
            .set({ status: "COMPLETED", completed_at: new Date(), updated_at: new Date() })
            .where(and(eq(sellerPayouts.id, payout.id), inArray(sellerPayouts.status, ["PENDING", "PROCESSING"])))
            .returning({ id: sellerPayouts.id });
        // Drain the GL wallet (DR 22000) — idempotent on reference = external_id.
        // Run on the first transition AND on a retry where it is already COMPLETED
        // (a previous drain may have failed), so the wallet always ends up debited.
        if (won.length > 0 || payout.status === "COMPLETED") {
            // MUST succeed; on failure rethrow so the webhook returns 500 and Xendit
            // retries. Never leave the reservation released without the GL drained —
            // that is the double-pay hole.
            try {
                await drainSellerPayoutGL({
                    sellerId: payout.seller_id,
                    amount: Number(payout.amount),
                    reference: payout.external_id,
                });
            } catch (e) {
                logger.error("payout:gl_drain_failed", { payoutId: payout.id, error: String(e) });
                throw e;
            }
        }
    } else if (status === "FAILED") {
        await db
            .update(sellerPayouts)
            .set({ status: "FAILED", failure_reason: input.failureReason || "Disbursement gagal", updated_at: new Date() })
            .where(and(eq(sellerPayouts.id, payout.id), inArray(sellerPayouts.status, ["PENDING", "PROCESSING"])));
    }
}
