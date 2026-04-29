import { config } from "dotenv";

config({ path: ".env.production" });
config({ path: ".env.local" });

import { db } from "../src/db";
import { affiliate_accounts, seller_kyc, users } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { needsPdpFieldReencryption, reencryptPdpField } from "../src/lib/crypto/pdp-field";

type SweepStats = {
    usersPhone: number;
    kycNotes: number;
    affiliatePayoutAccount: number;
};

async function runSweep(): Promise<SweepStats> {
    const stats: SweepStats = {
        usersPhone: 0,
        kycNotes: 0,
        affiliatePayoutAccount: 0,
    };

    const allUsers = await db.query.users.findMany({
        columns: { id: true, phone: true },
    });

    for (const row of allUsers) {
        if (!needsPdpFieldReencryption(row.phone)) continue;
        await db
            .update(users)
            .set({ phone: reencryptPdpField(row.phone), updated_at: new Date() })
            .where(eq(users.id, row.id));
        stats.usersPhone++;
    }

    const allKyc = await db.query.seller_kyc.findMany({
        columns: { user_id: true, notes: true },
    });

    for (const row of allKyc) {
        if (!needsPdpFieldReencryption(row.notes)) continue;
        await db
            .update(seller_kyc)
            .set({ notes: reencryptPdpField(row.notes), updated_at: new Date() })
            .where(eq(seller_kyc.user_id, row.user_id));
        stats.kycNotes++;
    }

    const allAffiliateAccounts = await db.query.affiliate_accounts.findMany({
        columns: { user_id: true, payout_account: true },
    });

    for (const row of allAffiliateAccounts) {
        if (!needsPdpFieldReencryption(row.payout_account)) continue;
        await db
            .update(affiliate_accounts)
            .set({ payout_account: reencryptPdpField(row.payout_account), updated_at: new Date() })
            .where(eq(affiliate_accounts.user_id, row.user_id));
        stats.affiliatePayoutAccount++;
    }

    return stats;
}

async function main() {
    const startedAt = Date.now();
    const stats = await runSweep();
    const elapsedMs = Date.now() - startedAt;

    console.log("PDP re-encryption sweep completed.");
    console.log(JSON.stringify({
        ...stats,
        elapsedMs,
        keyId: process.env.PDP_FIELD_ENCRYPTION_KEY_ID || "k1",
    }, null, 2));
}

main().catch((error) => {
    console.error("PDP re-encryption sweep failed:", error);
    process.exit(1);
});
