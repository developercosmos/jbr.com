// One-time backfill: infer products.sport from title/category for existing rows.
//
// The `sport` column ships null; this assigns a best-guess sport so "Browse by
// Sport" and the sport filter are populated immediately. Conservative: only sets
// a sport on a confident keyword/category match, leaves the rest null (shown as
// "Others"). Sellers can correct any row from the product edit form.
//
//   cd /var/www/jbr
//   set -a; . .env.local; set +a
//   node scripts/backfill-product-sport.mjs            # DRY RUN (default)
//   node scripts/backfill-product-sport.mjs --execute  # apply
//
// Idempotent: only fills rows where sport IS NULL; re-running is safe.

import postgres from "postgres";

const EXECUTE = process.argv.includes("--execute");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("DATABASE_URL not set (source .env.local first)");
    process.exit(2);
}

/** Returns an enum sport, or null to leave the row uncategorised. */
function inferSport(title, categoryName) {
    const t = (title || "").toLowerCase();
    const c = (categoryName || "").toLowerCase();

    if (/pickle\s?ball/.test(t)) return "PICKLEBALL";
    if (/padel|bullpadel/.test(t)) return "PADEL";
    if (/squash/.test(t)) return "SQUASH";
    if (/badminton|shuttle\s?cock|\bkok\b/.test(t)) return "BADMINTON";
    if (/\btennis\b/.test(t) && !/table\s?tennis|tenis\s?meja|ping\s?pong/.test(t)) return "TENNIS";
    if (/futsal|sepak\s?bola|\bsoccer\b|\bbola\b/.test(t)) return "SEPAK_BOLA";

    // Clothing / accessories / bags / shoes → Fashion & Accessories.
    if (/pakaian|aksesoris|aksesori|tas\b|sepatu|fashion|apparel|jersey|jaket/.test(c)) return "FASHION";
    if (/jersey|kaos|kaus|jaket|topi|tas\b|sepatu|sandal/.test(t)) return "FASHION";

    return null;
}

const sql = postgres(DATABASE_URL, { max: 2 });

try {
    const rows = await sql`
        SELECT p.id, p.title, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.sport IS NULL
    `;

    const tally = {};
    const updates = [];
    for (const r of rows) {
        const sport = inferSport(r.title, r.category_name);
        if (!sport) continue;
        tally[sport] = (tally[sport] ?? 0) + 1;
        updates.push({ id: r.id, sport, title: r.title });
    }

    console.log(`Produk tanpa sport: ${rows.length}`);
    console.log(`Akan di-set: ${updates.length}`);
    console.log("Rincian:", tally);
    for (const u of updates.slice(0, 40)) {
        console.log(`  ${u.sport.padEnd(11)} <- ${u.title}`);
    }
    if (updates.length > 40) console.log(`  ... (+${updates.length - 40} lagi)`);

    if (!EXECUTE) {
        console.log("\nDRY RUN. Tambah --execute untuk menerapkan.");
    } else {
        for (const u of updates) {
            await sql`UPDATE products SET sport = ${u.sport}::product_sport WHERE id = ${u.id}`;
        }
        console.log(`\nDONE. ${updates.length} produk diperbarui.`);
    }
} finally {
    await sql.end({ timeout: 5 });
}
