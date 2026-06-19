/**
 * One-off: run the order-expiry sweep now (cancel unpaid orders older than the
 * TTL, restock, expire invoices, notify buyer + seller). Same logic as the
 * scheduled trust-sweeps cron, run on demand.
 *
 *   cd /var/www/jbr
 *   set -a; . .env.local; set +a
 *   npx tsx scripts/run-order-expiry.ts
 */
import { runOrderExpirySweep } from "@/actions/payments";

runOrderExpirySweep()
    .then((res) => {
        console.log("Order expiry sweep selesai:", JSON.stringify(res));
        process.exit(0);
    })
    .catch((err) => {
        console.error("GAGAL:", err);
        process.exit(1);
    });
