// One-time migration: move legacy affiliate identity documents (KTP photo +
// Surat Pernyataan) from PUBLIC storage to the private files flow.
//
// Background: before commit 6a7bfb5, the affiliate form uploaded these via
// /api/upload, which stored them world-readable under /uploads/ktp/... and
// /uploads/statements/... with the URL kept in affiliate_accounts.ktp_url /
// statement_url. The new flow stores them as PRIVATE files rows
// (is_public=false, under kyc/<user_id>/...) served only via /api/files/[id].
//
// This script, per affiliate_accounts row:
//   1. resolves the legacy public URL to the file on disk,
//   2. copies it into the private layout kyc/<user_id>/<ktp|statement>/,
//   3. inserts a files row (is_public=false, sha256 content_hash),
//   4. sets ktp_file_id / statement_file_id and NULLs the legacy URL,
//   5. deletes the old public file from disk (only after the DB commit).
// Idempotent: rows that already have *_file_id are skipped; re-running is safe.
//
// It moves PHYSICAL files, so it does NOT run via the drizzle/*.sql ledger.
// Run it manually ON THE SERVER (where /var/www/jbr/uploads lives):
//
//   cd /var/www/jbr
//   set -a; . .env.local; set +a
//   node scripts/migrate-affiliate-private-docs.mjs            # DRY RUN (default)
//   node scripts/migrate-affiliate-private-docs.mjs --execute  # apply
//
// Flags: --execute (apply changes; default is dry-run), --limit N (first N rows).
// Requires: DATABASE_URL. Optional: LOCAL_UPLOAD_DIR (default /var/www/jbr/uploads
// in production, public/uploads otherwise), LOCAL_UPLOAD_PUBLIC_PATH (/uploads).

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const EXECUTE = process.argv.includes("--execute");
const limitArgIdx = process.argv.indexOf("--limit");
const LIMIT = limitArgIdx > -1 ? Number.parseInt(process.argv[limitArgIdx + 1], 10) : null;

const MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
};

function fail(msg) {
    console.error(`FATAL: ${msg}`);
    process.exit(1);
}

if (process.env.AWS_S3_BUCKET) {
    fail("AWS_S3_BUCKET terdeteksi — skrip ini hanya untuk penyimpanan LOKAL. Alur S3 di luar cakupan.");
}
if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL belum di-set. Jalankan: set -a; . .env.local; set +a");
}

const PUBLIC_PATH = (process.env.LOCAL_UPLOAD_PUBLIC_PATH || "/uploads").replace(/\/$/, "");
const BASE_DIR =
    process.env.LOCAL_UPLOAD_DIR ||
    (process.env.NODE_ENV === "production" ? "/var/www/jbr/uploads" : path.join(process.cwd(), "public", "uploads"));

function urlToRelative(urlOrPath) {
    let pathname = urlOrPath;
    if (/^https?:\/\//i.test(urlOrPath)) {
        try {
            pathname = new URL(urlOrPath).pathname;
        } catch {
            return null;
        }
    }
    if (!pathname.startsWith(`${PUBLIC_PATH}/`)) return null;
    return decodeURIComponent(pathname.slice(PUBLIC_PATH.length + 1));
}

function resolveUnderBase(relative) {
    const abs = path.resolve(BASE_DIR, relative);
    const base = path.resolve(BASE_DIR);
    if (!abs.startsWith(base + path.sep)) return null; // traversal guard
    return abs;
}

const sql = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });

const stats = { rows: 0, migrated: 0, clearedMissing: 0, skipped: 0, errors: 0 };

async function migrateDoc(row, kind) {
    const urlCol = kind === "ktp" ? "ktp_url" : "statement_url";
    const idCol = kind === "ktp" ? "ktp_file_id" : "statement_file_id";
    const legacyUrl = row[urlCol];

    if (row[idCol]) {
        if (legacyUrl) {
            // Already has a private file; just drop the dangling public URL.
            console.log(`[${EXECUTE ? "FIX" : "DRY"}] ${row.user_id} ${kind}: sudah punya ${idCol}, kosongkan ${urlCol}`);
            if (EXECUTE) {
                await sql`UPDATE affiliate_accounts SET ${sql(urlCol)} = NULL, updated_at = now() WHERE user_id = ${row.user_id}`;
            }
        }
        return;
    }
    if (!legacyUrl) return;

    const relative = urlToRelative(legacyUrl);
    const oldAbs = relative ? resolveUnderBase(relative) : null;
    if (!oldAbs) {
        console.log(`[SKIP] ${row.user_id} ${kind}: URL tidak dikenali (${legacyUrl})`);
        stats.skipped++;
        return;
    }

    let bytes;
    try {
        bytes = await fs.readFile(oldAbs);
    } catch {
        console.log(`[MISS] ${row.user_id} ${kind}: file tidak ada di disk (${relative}) -> ${urlCol} dikosongkan`);
        stats.clearedMissing++;
        if (EXECUTE) {
            await sql`UPDATE affiliate_accounts SET ${sql(urlCol)} = NULL, updated_at = now() WHERE user_id = ${row.user_id}`;
        }
        return;
    }

    const ext = path.extname(oldAbs).toLowerCase();
    const mime = MIME_BY_EXT[ext];
    if (!mime) {
        console.log(`[SKIP] ${row.user_id} ${kind}: ekstensi tidak didukung (${ext})`);
        stats.skipped++;
        return;
    }

    const slot = kind === "ktp" ? "ktp" : "statement";
    const newName = `${slot}-${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
    const newRelDir = path.posix.join("kyc", row.user_id, slot);
    const newRel = path.posix.join(newRelDir, newName);
    const newAbs = resolveUnderBase(newRel);
    const storageKey = `${PUBLIC_PATH}/${newRel}`;
    const contentHash = createHash("sha256").update(bytes).digest("hex");

    if (!EXECUTE) {
        console.log(`[DRY] ${row.user_id} ${kind}: ${relative} -> ${newRel} (${bytes.length} bytes, ${mime})`);
        stats.migrated++;
        return;
    }

    // Copy first, commit the DB switch, then remove the old public copy — so a
    // failure at any point never leaves the row pointing at a missing file.
    await fs.mkdir(path.dirname(newAbs), { recursive: true });
    await fs.copyFile(oldAbs, newAbs);
    try {
        await sql.begin(async (tx) => {
            const [fileRow] = await tx`
                INSERT INTO files (filename, original_name, mime_type, file_type, size,
                                   storage_type, storage_key, folder, content_hash, is_public, uploaded_by)
                VALUES (${newName}, ${path.basename(oldAbs)}, ${mime},
                        ${mime === "application/pdf" ? "document" : "image"}, ${bytes.length},
                        'local', ${storageKey}, ${newRelDir}, ${contentHash}, false, ${row.user_id})
                RETURNING id`;
            await tx`
                UPDATE affiliate_accounts
                SET ${tx(idCol)} = ${fileRow.id}, ${tx(urlCol)} = NULL, updated_at = now()
                WHERE user_id = ${row.user_id}`;
        });
    } catch (e) {
        await fs.unlink(newAbs).catch(() => {});
        throw e;
    }
    await fs.unlink(oldAbs).catch((e) => console.log(`[WARN] ${row.user_id} ${kind}: gagal hapus file lama (${e.message}) — hapus manual: ${oldAbs}`));
    console.log(`[OK] ${row.user_id} ${kind}: ${relative} -> ${newRel}`);
    stats.migrated++;
}

async function main() {
    console.log(`Mode      : ${EXECUTE ? "EXECUTE (mengubah DB + memindahkan file)" : "DRY RUN (tidak mengubah apa pun)"}`);
    console.log(`Upload dir: ${BASE_DIR}`);
    try {
        await fs.access(BASE_DIR);
    } catch {
        fail(`Upload dir tidak ditemukan: ${BASE_DIR} (set LOCAL_UPLOAD_DIR bila berbeda)`);
    }

    const rows = await sql`
        SELECT user_id, ktp_url, ktp_file_id, statement_url, statement_file_id
        FROM affiliate_accounts
        WHERE (ktp_url IS NOT NULL OR statement_url IS NOT NULL)
        ORDER BY created_at ASC
        ${LIMIT ? sql`LIMIT ${LIMIT}` : sql``}`;

    console.log(`Baris dengan dokumen legacy: ${rows.length}\n`);
    for (const row of rows) {
        stats.rows++;
        for (const kind of ["ktp", "statement"]) {
            try {
                await migrateDoc(row, kind);
            } catch (e) {
                stats.errors++;
                console.error(`[ERR] ${row.user_id} ${kind}: ${e instanceof Error ? e.message : e}`);
            }
        }
    }

    console.log(`\nRingkasan: ${stats.rows} baris diperiksa, ${stats.migrated} dokumen ${EXECUTE ? "dimigrasi" : "akan dimigrasi"}, ` +
        `${stats.clearedMissing} URL mati ${EXECUTE ? "dikosongkan" : "akan dikosongkan"}, ${stats.skipped} dilewati, ${stats.errors} error.`);
    await sql.end();
    process.exit(stats.errors > 0 ? 1 : 0);
}

main().catch(async (e) => {
    console.error(e);
    await sql.end().catch(() => {});
    process.exit(1);
});
