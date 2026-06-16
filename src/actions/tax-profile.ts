"use server";

// Profil pajak seller (PMK 37/2025): NPWP/NIK + alamat korespondensi,
// pernyataan omzet <= Rp500jt, dan pelaporan saat omzet melewati ambang.

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { seller_kyc, seller_tax_profiles, tax_withholdings, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decryptPdpField, encryptPdpField } from "@/lib/crypto/pdp-field";
import { getPph22Config, getSellerYtdGross } from "@/actions/accounting/pph22-internal";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

export async function getMySellerTaxStatus() {
    const user = await getCurrentUser();
    const year = new Date().getFullYear();

    const [profile, kyc, config, ytdGross, withheldRow, sellerRow] = await Promise.all([
        db.query.seller_tax_profiles.findFirst({ where: eq(seller_tax_profiles.user_id, user.id) }),
        db.query.seller_kyc.findFirst({
            where: eq(seller_kyc.user_id, user.id),
            columns: { nik: true, status: true },
        }),
        getPph22Config(),
        getSellerYtdGross(user.id, year),
        db
            .select({ total: sql<string>`coalesce(sum(${tax_withholdings.amount}), '0')` })
            .from(tax_withholdings)
            .where(and(eq(tax_withholdings.seller_id, user.id), eq(tax_withholdings.tax_year, year))),
        db.query.users.findFirst({ where: eq(users.id, user.id), columns: { tier: true } }),
    ]);

    const kycNik = kyc?.nik ? decryptPdpField(kyc.nik) : null;
    const declarationActive = profile?.omzet_declared_year === year;
    const crossedDeclared = profile?.crossed_declared_year === year;

    return {
        year,
        sellerTier: (sellerRow?.tier ?? "T0") as "T0" | "T1" | "T2",
        pph22Enabled: config.enabled,
        pph22Rate: config.rate,
        threshold: config.threshold,
        ytdGross,
        overThreshold: ytdGross > config.threshold,
        withheldYtd: Number(withheldRow?.[0]?.total ?? 0),
        profile: {
            exists: !!profile,
            taxIdKind: profile?.tax_id_kind ?? null,
            npwp: profile?.npwp ? decryptPdpField(profile.npwp) : null,
            correspondenceAddress: profile?.correspondence_address ?? null,
            pkp: profile?.pkp ?? false,
            declarationActive,
            declaredAt: profile?.omzet_declared_at?.toISOString() ?? null,
            crossedDeclared,
            crossedDeclaredAt: profile?.crossed_declared_at?.toISOString() ?? null,
        },
        kycNikMasked: kycNik && kycNik.length === 16 ? `${kycNik.slice(0, 6)}********${kycNik.slice(14)}` : null,
    };
}

const saveTaxProfileSchema = z.object({
    taxIdKind: z.enum(["NPWP", "NIK"]),
    npwp: z
        .string()
        .trim()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => v.length === 0 || v.length === 15 || v.length === 16, "NPWP harus 15–16 digit angka.")
        .optional(),
    correspondenceAddress: z.string().trim().min(10, "Alamat korespondensi minimal 10 karakter.").max(500),
    pkp: z.boolean().optional(),
});

export async function saveSellerTaxProfile(input: z.infer<typeof saveTaxProfileSchema>) {
    try {
        return await saveSellerTaxProfileInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyimpan profil pajak.");
        logger.warn("tax:save_profile_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function saveSellerTaxProfileInternal(input: z.infer<typeof saveTaxProfileSchema>) {
    const user = await getCurrentUser();
    const validated = saveTaxProfileSchema.parse(input);

    if (validated.taxIdKind === "NPWP" && !validated.npwp) {
        throw new Error("Isi nomor NPWP, atau pilih NIK sebagai identitas pajak.");
    }
    if (validated.taxIdKind === "NIK") {
        const kyc = await db.query.seller_kyc.findFirst({
            where: eq(seller_kyc.user_id, user.id),
            columns: { nik: true },
        });
        if (!kyc?.nik) {
            throw new Error("NIK belum tersedia — lengkapi KYC (KTP) dulu, atau gunakan NPWP.");
        }
    }

    const values = {
        tax_id_kind: validated.taxIdKind,
        npwp: validated.npwp ? encryptPdpField(validated.npwp) : null,
        correspondence_address: validated.correspondenceAddress,
        pkp: validated.pkp ?? false,
        updated_at: new Date(),
    };

    await db
        .insert(seller_tax_profiles)
        .values({ user_id: user.id, ...values })
        .onConflictDoUpdate({ target: seller_tax_profiles.user_id, set: values });

    revalidatePath("/seller/keuangan");
    return { success: true as const };
}

/** Surat pernyataan omzet <= Rp500jt untuk tahun pajak berjalan (pengecualian PPh 22). */
export async function declareOmzetUnderThreshold() {
    try {
        return await declareOmzetUnderThresholdInternal();
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyimpan deklarasi.");
        logger.warn("tax:declare_under_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function declareOmzetUnderThresholdInternal() {
    const user = await getCurrentUser();
    const year = new Date().getFullYear();

    const profile = await db.query.seller_tax_profiles.findFirst({
        where: eq(seller_tax_profiles.user_id, user.id),
    });
    if (!profile?.tax_id_kind || !profile.correspondence_address) {
        throw new Error("Lengkapi identitas pajak (NPWP/NIK) dan alamat korespondensi terlebih dahulu.");
    }

    const config = await getPph22Config();
    const ytd = await getSellerYtdGross(user.id, year);
    if (ytd > config.threshold) {
        throw new Error(
            `Omzet Anda tahun ${year} sudah melewati Rp ${config.threshold.toLocaleString("id-ID")} — gunakan pelaporan "omzet melewati ambang".`
        );
    }

    await db
        .update(seller_tax_profiles)
        .set({ omzet_declared_year: year, omzet_declared_at: new Date(), updated_at: new Date() })
        .where(eq(seller_tax_profiles.user_id, user.id));

    revalidatePath("/seller/keuangan");
    return { success: true as const, year };
}

/** Pernyataan omzet tahun berjalan telah melewati ambang (pemungutan mulai bulan berikutnya). */
export async function declareOmzetCrossedThreshold() {
    try {
        return await declareOmzetCrossedThresholdInternal();
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyimpan deklarasi.");
        logger.warn("tax:declare_crossed_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function declareOmzetCrossedThresholdInternal() {
    const user = await getCurrentUser();
    const year = new Date().getFullYear();

    const profile = await db.query.seller_tax_profiles.findFirst({
        where: eq(seller_tax_profiles.user_id, user.id),
    });
    if (!profile?.tax_id_kind || !profile.correspondence_address) {
        throw new Error("Lengkapi identitas pajak (NPWP/NIK) dan alamat korespondensi terlebih dahulu.");
    }

    await db
        .update(seller_tax_profiles)
        .set({ crossed_declared_year: year, crossed_declared_at: new Date(), updated_at: new Date() })
        .where(eq(seller_tax_profiles.user_id, user.id));

    revalidatePath("/seller/keuangan");
    return { success: true as const, year };
}
