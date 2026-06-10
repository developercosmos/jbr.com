// PPh 22 marketplace (PMK 37/2025) — pure decision/computation helpers shared by
// the GL posting pipeline and the seller tax actions. NOT a "use server" file
// (same pattern as posting-internal): importable without becoming public actions.
//
// Aturan yang diimplementasikan:
// - Pemungutan hanya berjalan bila platform ditunjuk DJP → tax.pph22_enabled
//   (default FALSE). Tarif: tax.pph22_rate (default 0,5%) dari peredaran bruto.
// - Orang pribadi dengan omzet <= tax.pph22_omzet_threshold (default Rp500jt)
//   pada tahun pajak berjalan TIDAK dipungut bila sudah menyampaikan surat
//   pernyataan untuk tahun tersebut (seller_tax_profiles.omzet_declared_year).
// - Saat omzet melewati ambang, seller wajib menyampaikan pernyataan melewati
//   ambang; pemungutan dimulai AWAL BULAN BERIKUTNYA setelah pernyataan
//   (crossed_declared_at) diterima.

import { db } from "@/db";
import { notifications, sales_register, seller_tax_profiles } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getSetting } from "@/actions/accounting/settings";

export interface Pph22Config {
    enabled: boolean;
    rate: number; // e.g. 0.005
    threshold: number; // e.g. 500_000_000
}

export async function getPph22Config(at?: Date): Promise<Pph22Config> {
    const [enabled, rate, threshold] = await Promise.all([
        getSetting<boolean>("tax.pph22_enabled", { at, defaultValue: false }),
        getSetting<number>("tax.pph22_rate", { at, defaultValue: 0.005 }),
        getSetting<number>("tax.pph22_omzet_threshold", { at, defaultValue: 500_000_000 }),
    ]);
    return {
        enabled: Boolean(enabled),
        rate: Number(rate ?? 0.005) || 0.005,
        threshold: Number(threshold ?? 500_000_000) || 500_000_000,
    };
}

/** Peredaran bruto (omzet) seller pada satu tahun pajak, dari sales_register. */
export async function getSellerYtdGross(sellerId: string, taxYear: number): Promise<number> {
    const [row] = await db
        .select({ total: sql<string>`coalesce(sum(${sales_register.gross}), '0')` })
        .from(sales_register)
        .where(
            and(
                eq(sales_register.seller_id, sellerId),
                eq(sales_register.event, "SALE"),
                sql`extract(year from ${sales_register.event_at}) = ${taxYear}`
            )
        );
    return Number(row?.total ?? 0);
}

export interface Pph22Decision {
    subject: boolean;
    amount: number;
    rate: number;
    taxYear: number;
    reason:
        | "disabled"
        | "declared_under_threshold"
        | "withhold_no_declaration"
        | "withhold_after_crossing";
}

function firstDayOfNextMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/**
 * Keputusan pungut PPh 22 untuk satu pelepasan order (escrow release).
 * Side effect ringan: notifikasi idempotent ke seller saat omzetnya melewati
 * ambang padahal deklarasi <=threshold masih aktif (wajib lapor crossing).
 */
export async function decidePph22ForRelease(params: {
    sellerId: string;
    grossPaid: number;
    completedAt?: Date;
}): Promise<Pph22Decision> {
    const at = params.completedAt ?? new Date();
    const taxYear = at.getFullYear();
    const config = await getPph22Config(at);
    if (!config.enabled) {
        return { subject: false, amount: 0, rate: config.rate, taxYear, reason: "disabled" };
    }

    const profile = await db.query.seller_tax_profiles.findFirst({
        where: eq(seller_tax_profiles.user_id, params.sellerId),
    });

    const declarationActive = profile?.omzet_declared_year === taxYear;
    const crossingActive =
        profile?.crossed_declared_year === taxYear &&
        !!profile?.crossed_declared_at &&
        at >= firstDayOfNextMonth(profile.crossed_declared_at);

    if (declarationActive && !crossingActive) {
        // Pengecualian pemungutan — tapi pantau ambang dan minta pernyataan
        // crossing saat terlampaui (paling lambat akhir bulan terlampauinya).
        try {
            const ytd = await getSellerYtdGross(params.sellerId, taxYear);
            if (ytd + params.grossPaid > config.threshold && profile?.crossed_declared_year !== taxYear) {
                await db
                    .insert(notifications)
                    .values({
                        user_id: params.sellerId,
                        type: "SYSTEM",
                        title: "Omzet Melewati Rp500 Juta — Wajib Lapor",
                        message:
                            `Peredaran bruto Anda tahun ${taxYear} telah melewati ambang Rp ${config.threshold.toLocaleString("id-ID")}. ` +
                            "Sesuai PMK 37/2025, sampaikan pernyataan melewati ambang di menu Keuangan → Pajak paling lambat akhir bulan ini. " +
                            "Setelah pernyataan diterima, pemungutan PPh 22 (0,5%) dimulai awal bulan berikutnya.",
                        idempotency_key: `PPH22_CROSSING_DUE:${params.sellerId}:${taxYear}`,
                        data: { tax_year: taxYear },
                    })
                    .onConflictDoNothing();
            }
        } catch (e) {
            console.error("[pph22] crossing check failed:", e instanceof Error ? e.message : e);
        }
        return { subject: false, amount: 0, rate: config.rate, taxYear, reason: "declared_under_threshold" };
    }

    const amount = Math.round(params.grossPaid * config.rate * 100) / 100;
    return {
        subject: amount > 0,
        amount,
        rate: config.rate,
        taxYear,
        reason: crossingActive ? "withhold_after_crossing" : "withhold_no_declaration",
    };
}
