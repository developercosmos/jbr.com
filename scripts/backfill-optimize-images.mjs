/**
 * Backfill: optimize EXISTING product/store/review images in local storage, using
 * ffmpeg (already on the server, and unlike sharp it runs on this VM's minimal CPU).
 *
 * Why: originals were stored RAW (multi-MB phone photos) and Next/Image cannot
 * optimize on this CPU (sharp native needs x86-64-v2; sharp-wasm needs Wasm-SIMD —
 * both unavailable). So images are served full-size. This re-encodes oversized/heavy
 * originals IN PLACE (same path, same format) to a 2048px max edge + good quality.
 * No DB change (paths unchanged). Once the VM CPU is upgraded to v2+, Next/Image will
 * additionally serve AVIF/WebP responsively on top of these smaller sources.
 *
 * SAFE: dry-run by default; backs up each original before overwriting (rollback +
 * idempotency); only writes when the result is actually smaller; never enlarges;
 * traversal-guarded; skips small files and already-processed ones.
 *
 * Run ON the prod server:
 *   cd /var/www/jbr && set -a; for f in .env.production .env.local; do [ -f "$f" ] && . "$f"; done; set +a; node scripts/backfill-optimize-images.mjs            # dry-run
 *   ...                                                                                                                                            node scripts/backfill-optimize-images.mjs --execute
 *   ... node scripts/backfill-optimize-images.mjs --execute --limit 50
 */
import postgres from "postgres";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const run = promisify(execFile);
const EXECUTE = process.argv.includes("--execute");
const li = process.argv.indexOf("--limit");
const LIMIT = li >= 0 ? Number(process.argv[li + 1]) : Infinity;

const MAX_EDGE = 2048;
const MIN_BYTES = 350 * 1024; // only touch files heavier than this (the heavy ones)
const PUBLIC_PREFIX = (process.env.LOCAL_PUBLIC_PATH || "/uploads").replace(/\/$/, "");
const UPLOAD_DIR = path.resolve(
    process.env.LOCAL_UPLOAD_DIR || (process.env.NODE_ENV === "production" ? "/var/www/jbr/uploads" : "public/uploads"),
);
const BACKUP_DIR = path.resolve(UPLOAD_DIR, "..", "uploads-orig-backup");
const SCALE = `scale='min(${MAX_EDGE},iw)':'min(${MAX_EDGE},ih)':force_original_aspect_ratio=decrease`;

if (!process.env.DATABASE_URL) { console.error("DATABASE_URL required"); process.exit(1); }
if (process.env.AWS_S3_BUCKET) { console.error("Refusing: AWS_S3_BUCKET set (local-fs only)."); process.exit(1); }

const sql = postgres(process.env.DATABASE_URL, { max: 4 });

function toRelative(u) {
    if (typeof u !== "string" || !u) return null;
    let p = u;
    if (p.startsWith("http://") || p.startsWith("https://")) { try { p = new URL(p).pathname; } catch { return null; } }
    if (p.startsWith(PUBLIC_PREFIX + "/")) p = p.slice(PUBLIC_PREFIX.length + 1);
    else if (p.startsWith("/uploads/")) p = p.slice("/uploads/".length);
    else return null;
    return p.replace(/^\/+/, "");
}
function underBase(base, rel) {
    const abs = path.resolve(base, rel);
    return abs !== base && !abs.startsWith(base + path.sep) ? null : abs;
}

async function collectPaths() {
    const set = new Set();
    const addArr = (rows) => { for (const r of rows) if (Array.isArray(r.images)) for (const u of r.images) { const x = toRelative(u); if (x) set.add(x); } };
    const addTxt = (rows) => { for (const r of rows) { const x = toRelative(r.image); if (x) set.add(x); } };
    addArr(await sql`SELECT images FROM products WHERE images IS NOT NULL`);
    addArr(await sql`SELECT images FROM product_variants WHERE images IS NOT NULL`);
    try { addArr(await sql`SELECT images FROM reviews WHERE images IS NOT NULL`); } catch {}
    addTxt(await sql`SELECT image FROM users WHERE image LIKE '/uploads/%' OR image LIKE 'https://%/uploads/%'`);
    addTxt(await sql`SELECT store_banner_url AS image FROM users WHERE store_banner_url LIKE '/uploads/%' OR store_banner_url LIKE 'https://%/uploads/%'`);
    return [...set];
}

function ffmpegArgs(inPath, outPath, ext) {
    const base = ["-hide_banner", "-loglevel", "error", "-y", "-i", inPath, "-vf", SCALE];
    if (ext === ".png") return [...base, "-c:v", "png", "-compression_level", "9", outPath];
    if (ext === ".webp") return [...base, "-c:v", "libwebp", "-quality", "82", outPath];
    return [...base, "-qscale:v", "4", outPath]; // jpeg
}

async function processOne(rel) {
    const abs = underBase(UPLOAD_DIR, rel);
    if (!abs) return "skip-traversal";
    const ext = path.extname(abs).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return "skip-nonimage";

    let stat; try { stat = await fs.stat(abs); } catch { return "missing"; }
    const backupAbs = underBase(BACKUP_DIR, rel);
    if (backupAbs) { try { await fs.access(backupAbs); return "skip-done"; } catch {} }
    if (stat.size < MIN_BYTES) return "skip-small";

    const tmp = path.join(os.tmpdir(), `opt-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    try {
        await run("ffmpeg", ffmpegArgs(abs, tmp, ext), { timeout: 120000 });
    } catch (e) { try { await fs.unlink(tmp); } catch {} return "encode-failed"; }

    let outStat; try { outStat = await fs.stat(tmp); } catch { return "encode-failed"; }
    if (outStat.size === 0 || outStat.size >= stat.size) { await fs.unlink(tmp).catch(() => {}); return "skip-not-smaller"; }

    RESULT.before += stat.size; RESULT.after += outStat.size;
    if (!EXECUTE) { await fs.unlink(tmp).catch(() => {}); RESULT.sample.push([rel, stat.size, outStat.size]); return "would-optimize"; }

    await fs.mkdir(path.dirname(backupAbs), { recursive: true });
    await fs.copyFile(abs, backupAbs);
    await fs.rename(tmp, abs).catch(async () => { await fs.copyFile(tmp, abs); await fs.unlink(tmp).catch(() => {}); });
    RESULT.sample.push([rel, stat.size, outStat.size]);
    return "optimized";
}

const RESULT = { before: 0, after: 0, sample: [] };

(async () => {
    console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN"} | uploads=${UPLOAD_DIR} | backup=${BACKUP_DIR} | maxEdge=${MAX_EDGE} | minSize=${(MIN_BYTES / 1024).toFixed(0)}KB`);
    const paths = await collectPaths();
    console.log(`Found ${paths.length} referenced local image(s).`);
    const tally = {}; let n = 0;
    for (const rel of paths) {
        if (n >= LIMIT) break;
        const s = await processOne(rel);
        tally[s] = (tally[s] ?? 0) + 1;
        if (s === "optimized" || s === "would-optimize") n++;
    }
    console.log("\nSummary:", tally);
    for (const [rel, b, a] of RESULT.sample.slice(0, 30)) console.log(`  ${(b / 1024).toFixed(0)}KB -> ${(a / 1024).toFixed(0)}KB  ${rel}`);
    console.log(`\n${EXECUTE ? "Optimized" : "Would optimize"}: ${n} file(s), ${(RESULT.before / 1048576).toFixed(1)}MB -> ${(RESULT.after / 1048576).toFixed(1)}MB (saved ${((RESULT.before - RESULT.after) / 1048576).toFixed(1)}MB)`);
    if (!EXECUTE) console.log("DRY-RUN only — re-run with --execute to apply.");
    await sql.end();
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
