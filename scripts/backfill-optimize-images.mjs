/**
 * Backfill: optimize EXISTING product/store/review images in local storage.
 *
 * Root cause of heavy PDP loads: originals were stored RAW (multi-MB phone photos);
 * next/Image then had to decode+resize a huge source on every cache miss, and the
 * zoom lightbox served the full-res original. This script re-encodes oversized/heavy
 * originals IN PLACE (same path, same format) to a sane max edge + good quality, so
 * the served source is small. No DB change needed (paths are unchanged).
 *
 * SAFE: dry-run by default; backs up each original before overwriting (rollback +
 * idempotency); only writes when the result is actually smaller; never enlarges;
 * traversal-guarded to the uploads root; skips non-images and already-processed files.
 *
 * Run ON the prod server (local fs storage):
 *   cd /var/www/jbr && set -a; . .env.local; set +a; npx tsx scripts/backfill-optimize-images.mjs            # dry-run
 *   cd /var/www/jbr && set -a; . .env.local; set +a; npx tsx scripts/backfill-optimize-images.mjs --execute  # apply
 *   ... --execute --limit 50    # process first 50 (smoke)
 */
import postgres from "postgres";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const EXECUTE = process.argv.includes("--execute");
const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1]) : Infinity;

const MAX_EDGE = 2048; // long-edge cap (preserves display + zoom quality)
const BIG_BYTES = 1.5 * 1024 * 1024; // also reprocess heavy files even if dimensions are small
const PUBLIC_PREFIX = (process.env.LOCAL_PUBLIC_PATH || "/uploads").replace(/\/$/, "");
const UPLOAD_DIR = path.resolve(
    process.env.LOCAL_UPLOAD_DIR || (process.env.NODE_ENV === "production" ? "/var/www/jbr/uploads" : "public/uploads"),
);
const BACKUP_DIR = path.resolve(UPLOAD_DIR, "..", "uploads-orig-backup");

if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL required");
    process.exit(1);
}
if (process.env.AWS_S3_BUCKET) {
    console.error("Refusing to run: AWS_S3_BUCKET is set (this script only handles LOCAL fs storage).");
    process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 4 });

// Map a stored URL/path to a relative path under the uploads root (or null if it
// isn't a local /uploads asset).
function toRelative(u) {
    if (typeof u !== "string" || !u) return null;
    let p = u;
    if (p.startsWith("http://") || p.startsWith("https://")) {
        try {
            p = new URL(p).pathname;
        } catch {
            return null;
        }
    }
    if (p.startsWith(PUBLIC_PREFIX + "/")) p = p.slice(PUBLIC_PREFIX.length + 1);
    else if (p.startsWith("/uploads/")) p = p.slice("/uploads/".length);
    else return null; // not a local upload
    return p.replace(/^\/+/, "");
}

function resolveUnderBase(base, rel) {
    const abs = path.resolve(base, rel);
    if (abs !== base && !abs.startsWith(base + path.sep)) return null; // traversal guard
    return abs;
}

async function collectPaths() {
    const set = new Set();
    const addArr = (rows, col) => {
        for (const r of rows) {
            const arr = r[col];
            if (Array.isArray(arr)) for (const u of arr) { const rel = toRelative(u); if (rel) set.add(rel); }
        }
    };
    const addText = (rows, col) => {
        for (const r of rows) { const rel = toRelative(r[col]); if (rel) set.add(rel); }
    };
    addArr(await sql`SELECT images FROM products WHERE images IS NOT NULL`, "images");
    addArr(await sql`SELECT images FROM product_variants WHERE images IS NOT NULL`, "images");
    // reviews.images may not exist in every schema — guard.
    try { addArr(await sql`SELECT images FROM reviews WHERE images IS NOT NULL`, "images"); } catch {}
    addText(await sql`SELECT image FROM users WHERE image LIKE '/uploads/%' OR image LIKE 'https://%/uploads/%'`, "image");
    addText(await sql`SELECT store_banner_url AS image FROM users WHERE store_banner_url LIKE '/uploads/%' OR store_banner_url LIKE 'https://%/uploads/%'`, "image");
    return [...set];
}

const IMG_RE = /\.(jpe?g|png|webp)$/i;

async function processOne(rel) {
    const abs = resolveUnderBase(UPLOAD_DIR, rel);
    if (!abs) return { rel, status: "skip-traversal" };
    if (!IMG_RE.test(abs)) return { rel, status: "skip-nonimage" };

    let stat;
    try { stat = await fs.stat(abs); } catch { return { rel, status: "missing" }; }

    const backupAbs = resolveUnderBase(BACKUP_DIR, rel);
    if (backupAbs) {
        try { await fs.access(backupAbs); return { rel, status: "skip-done" }; } catch {}
    }

    let meta;
    try { meta = await sharp(abs, { failOn: "none" }).metadata(); } catch { return { rel, status: "skip-unreadable" }; }
    const w = meta.width ?? 0, h = meta.height ?? 0;
    const oversized = w > MAX_EDGE || h > MAX_EDGE;
    const heavy = stat.size > BIG_BYTES;
    if (!oversized && !heavy) return { rel, status: "skip-small", before: stat.size };

    const ext = path.extname(abs).toLowerCase();
    let pipeline = sharp(abs, { failOn: "none" }).rotate();
    if (oversized) pipeline = pipeline.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true });
    let out;
    try {
        out = ext === ".png"
            ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
            : ext === ".webp"
                ? await pipeline.webp({ quality: 82 }).toBuffer()
                : await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } catch (e) {
        return { rel, status: "encode-failed", error: String(e) };
    }

    if (out.length >= stat.size) return { rel, status: "skip-not-smaller", before: stat.size, after: out.length };

    if (!EXECUTE) return { rel, status: "would-optimize", before: stat.size, after: out.length };

    // Backup original (outside the served uploads dir), then overwrite atomically.
    await fs.mkdir(path.dirname(backupAbs), { recursive: true });
    await fs.copyFile(abs, backupAbs);
    const tmp = abs + ".tmp-opt";
    await fs.writeFile(tmp, out);
    await fs.rename(tmp, abs);
    return { rel, status: "optimized", before: stat.size, after: out.length };
}

(async () => {
    console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"} | uploads=${UPLOAD_DIR} | backup=${BACKUP_DIR} | maxEdge=${MAX_EDGE}`);
    const paths = await collectPaths();
    console.log(`Found ${paths.length} referenced local image(s).`);
    const tally = {};
    let beforeSum = 0, afterSum = 0, done = 0;
    for (const rel of paths) {
        if (done >= LIMIT) break;
        const r = await processOne(rel);
        tally[r.status] = (tally[r.status] ?? 0) + 1;
        if (r.before && (r.status === "optimized" || r.status === "would-optimize")) {
            beforeSum += r.before; afterSum += r.after; done++;
            if (done <= 40 || done % 50 === 0) {
                console.log(`  ${r.status}: ${rel}  ${(r.before / 1024).toFixed(0)}KB -> ${(r.after / 1024).toFixed(0)}KB`);
            }
        }
    }
    console.log("\nSummary:", tally);
    console.log(`Optimizable: ${done} file(s), ${(beforeSum / 1048576).toFixed(1)}MB -> ${(afterSum / 1048576).toFixed(1)}MB (saved ${((beforeSum - afterSum) / 1048576).toFixed(1)}MB)`);
    if (!EXECUTE) console.log("DRY-RUN only — re-run with --execute to apply.");
    await sql.end();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
