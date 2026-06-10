"use server";

import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireAdminFinanceSession } from "@/lib/admin-finance";
import { postPayout } from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { getT0Gates } from "@/actions/kyc";

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

    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        await postPayout({
            payoutId,
            sellerId: validated.sellerId,
            amount: validated.amount,
            bankFee: validated.bankFee,
        });
    }

    revalidatePath("/admin/finance/seller-ledger");

    return { success: true, payoutId };
}
