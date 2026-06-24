/**
 * Read-only check: fetch the courier list the admin checklist will show.
 *   cd .../web && set -a; . .env.local; set +a; npx tsx scripts/verify-couriers.ts
 * Imports ONLY from @/lib/biteship (no server-only chain).
 */
import { getBiteshipSettings, biteshipCouriers } from "@/lib/biteship";

(async () => {
    const s = await getBiteshipSettings();
    console.log("enabled:", s.enabled, "| hasApiKey:", !!s.apiKey, "| saved couriers:", s.couriers);
    if (!s.apiKey) {
        console.log("No API key — checklist would prompt to save the key first.");
        process.exit(0);
    }
    const list = await biteshipCouriers(s);
    console.log(`\nGET /v1/couriers -> ${list.length} courier companies:`);
    for (const c of list) {
        const on = s.couriers.includes(c.code) ? "[x]" : "[ ]";
        console.log(`  ${on} ${c.code.padEnd(12)} ${c.name.padEnd(20)} cod=${c.cod ? "Y" : "N"} services=${c.services}`);
    }
})().catch((e) => {
    console.error("ERR:", e instanceof Error ? e.message : String(e));
    process.exit(1);
});
