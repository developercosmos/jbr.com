/**
 * Read-only verification that Biteship is active + the API key works.
 *   cd /var/www/jbr && set -a; . .env.local; set +a; npx tsx scripts/verify-biteship.ts
 */
import { getBiteshipSettings, biteshipRates } from "@/lib/biteship";
import { getActiveShippingProvider } from "@/actions/shipping";

(async () => {
    const s = await getBiteshipSettings();
    console.log("=== Biteship settings (integration_settings) ===");
    console.log("  enabled    :", s.enabled);
    console.log("  hasApiKey  :", !!s.apiKey, s.apiKey ? `(len ${s.apiKey.length})` : "");
    console.log("  apiUrl     :", s.apiUrl);
    console.log("  couriers   :", s.couriers);
    console.log("  origin     : postal", s.origin?.postalCode || "-", "| coords", s.origin?.latitude || "-", s.origin?.longitude || "-");

    const provider = await getActiveShippingProvider();
    console.log("=== Active shipping provider:", provider, "===");

    if (!s.enabled || !s.apiKey) {
        console.log("Biteship NOT active (enabled/apiKey missing) — skipping live rate test.");
        process.exit(0);
    }

    // Live connectivity test. Use the configured origin if present, else a Jakarta sample.
    const origin = s.origin?.postalCode || (s.origin?.latitude && s.origin?.longitude)
        ? { postalCode: s.origin?.postalCode, latitude: s.origin?.latitude, longitude: s.origin?.longitude }
        : { postalCode: "10110" };

    console.log("\n=== Live rate test ->  destination Bandung 40111 ===");
    try {
        const rates = await biteshipRates(s, {
            origin,
            destination: { postalCode: "40111" },
            couriers: s.couriers,
            items: [{ name: "Test", value: 100000, weight: 1000, quantity: 1 }],
        });
        console.log("  rate options returned:", rates.length);
        rates.slice(0, 10).forEach((r) =>
            console.log(`   - ${r.courierName} ${r.serviceName} [${r.serviceCode}] Rp${r.price} (${r.duration})`)
        );
        console.log(rates.length > 0 ? "\nBITESHIP LIVE OK ✓" : "\nWARN: 0 rates (cek origin/kurir/area).");
    } catch (e) {
        console.log("  RATE TEST FAILED:", e instanceof Error ? e.message : String(e));
    }
    process.exit(0);
})().catch((e) => {
    console.error("VERIFY FAILED:", e);
    process.exit(1);
});
