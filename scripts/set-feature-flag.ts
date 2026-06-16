/**
 * Ops: enable/disable a feature flag directly (key + enabled + optional rollout).
 *
 * NOTE: bypasses the admin UI's audit log + trust-confirmation. For routine,
 * audited changes use /admin/feature-flags. This is for ops/automation.
 *
 *   cd /var/www/jbr
 *   set -a; . .env.local; set +a
 *   npx tsx scripts/set-feature-flag.ts --key=dif.compare_mode            # DRY RUN (show state)
 *   npx tsx scripts/set-feature-flag.ts --key=dif.compare_mode --off --execute
 *   npx tsx scripts/set-feature-flag.ts --key=dif.compare_mode --on --rollout=100 --execute
 */
import { db } from "@/db";
import { feature_flags } from "@/db/schema";
import { eq } from "drizzle-orm";
import { invalidateFeatureFlagCache } from "@/lib/feature-flags";

function arg(name: string): string | null {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.split("=").slice(1).join("=") : null;
}

const KEY = arg("key");
const EXECUTE = process.argv.includes("--execute");
const wantOn = process.argv.includes("--on");
const wantOff = process.argv.includes("--off");
const rolloutArg = arg("rollout");

async function main() {
    if (!KEY) {
        console.error("Wajib --key=<flag.key>");
        process.exit(2);
    }
    const existing = await db.query.feature_flags.findFirst({ where: eq(feature_flags.key, KEY) });
    if (!existing) {
        console.error(`Flag tidak ditemukan: ${KEY}`);
        process.exit(1);
    }
    console.log(`Flag ${KEY}: enabled=${existing.enabled}  rollout_pct=${existing.rollout_pct}`);

    if (!wantOn && !wantOff && rolloutArg === null) {
        console.log("DRY RUN: tak ada perubahan diminta. Tambah --on / --off / --rollout=<n> (+ --execute).");
        return;
    }

    const next: { enabled?: boolean; rollout_pct?: number } = {};
    if (wantOn) {
        next.enabled = true;
        next.rollout_pct = rolloutArg !== null ? Number(rolloutArg) : 100;
    } else if (wantOff) {
        next.enabled = false;
        next.rollout_pct = 0;
    } else if (rolloutArg !== null) {
        next.rollout_pct = Number(rolloutArg);
    }

    console.log(`Akan set -> ${JSON.stringify(next)}${EXECUTE ? "  (EXECUTE)" : "  (DRY RUN)"}`);
    if (!EXECUTE) {
        console.log("DRY RUN selesai. Tambah --execute untuk menerapkan.");
        return;
    }

    await db
        .update(feature_flags)
        .set({ ...next, updated_at: new Date() })
        .where(eq(feature_flags.key, KEY));
    await invalidateFeatureFlagCache();

    const after = await db.query.feature_flags.findFirst({ where: eq(feature_flags.key, KEY) });
    console.log(`DONE. ${KEY}: enabled=${after?.enabled}  rollout_pct=${after?.rollout_pct}`);
    console.log("Cache di-invalidate. App akan ikut dalam <=30s (TTL in-memory).");
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("GAGAL:", err);
        process.exit(1);
    });
