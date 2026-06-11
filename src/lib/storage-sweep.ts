/**
 * Storage sweep — find (and optionally delete) orphan files in the local
 * uploads directory, i.e. files no database row references anymore (abandoned
 * form uploads, replaced banners/photos, re-uploaded videos, ...).
 *
 * "Referenced" is discovered at RUNTIME, not from a hardcoded table list:
 * every text / varchar / json(b) / array column in the public schema is
 * scanned for values containing "uploads/" (covers products.images,
 * order_items.product_snapshot, chat attachments, reviews, disputes, and any
 * column added in the future), plus files.storage_key / files.variants which
 * store keys without the uploads/ prefix.
 *
 * Safety rails:
 *  - private trees (kyc/, ktp/, statements/) are never touched
 *  - files younger than minAgeHours are skipped — an upload legitimately sits
 *    unreferenced until its form is submitted
 *  - execute mode refuses to run when the reference scan looks broken
 *    (almost nothing referenced while the disk has many files)
 *  - deletions are constrained to paths resolving inside the uploads dir
 */
import { promises as fs } from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { storageConfig } from "./storage/config";

const EXCLUDED_TOP = new Set(["kyc", "ktp", "statements", "private", "quarantine"]);
const UPLOAD_PATH_RE = /uploads\/[A-Za-z0-9._%\-/]+/g;

export interface SweepEntry {
    rel: string;
    bytes: number;
    mtime: string;
    ageHours: number;
}

export interface SweepReport {
    base: string;
    execute: boolean;
    minAgeHours: number;
    refPaths: number;
    columnsScanned: number;
    scannedFiles: number;
    scannedBytes: number;
    excludedFiles: number;
    tooNew: SweepEntry[];
    orphans: SweepEntry[];
    orphanBytes: number;
    deletedFiles: number;
    deletedBytes: number;
    prunedDirs: number;
    errors: string[];
}

async function exec(query: string): Promise<Record<string, unknown>[]> {
    return (await db.execute(sql.raw(query))) as unknown as Record<string, unknown>[];
}

/** Normalize any DB-stored value/key/URL to a path relative to the uploads dir. */
function normalizeRef(raw: string): string | null {
    let v = raw;
    try {
        v = decodeURIComponent(v);
    } catch {
        // keep the raw form; the un-decoded variant is matched as-is
    }
    v = v.replace(/\\/g, "/");
    const i = v.indexOf("uploads/");
    if (i >= 0) v = v.slice(i + "uploads/".length);
    v = v.replace(/^\/+/, "").split("?")[0].split("#")[0];
    return v.length > 0 ? v : null;
}

async function collectReferencedPaths(report: SweepReport): Promise<Set<string>> {
    const refs = new Set<string>();

    const columns = await exec(
        "SELECT table_name, column_name FROM information_schema.columns " +
        "WHERE table_schema = 'public' " +
        "AND data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY')"
    );
    for (const c of columns) {
        const tbl = String(c.table_name);
        const col = String(c.column_name);
        try {
            const rows = await exec(
                `SELECT "${col}"::text AS v FROM "${tbl}" WHERE "${col}"::text LIKE '%uploads/%'`
            );
            report.columnsScanned++;
            for (const row of rows) {
                for (const m of String(row.v).matchAll(UPLOAD_PATH_RE)) {
                    const n = normalizeRef(m[0]);
                    if (n) refs.add(n);
                }
            }
        } catch (e) {
            report.errors.push(`ref-scan ${tbl}.${col}: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    // files.storage_key / files.variants hold keys WITHOUT the uploads/ prefix
    // (e.g. "kyc/<user>/ktp/x.jpg"); protect them explicitly.
    try {
        const rows = await exec("SELECT storage_key, COALESCE(variants::text, '') AS variants FROM files");
        for (const row of rows) {
            const k = normalizeRef(String(row.storage_key ?? ""));
            if (k) refs.add(k);
            for (const m of String(row.variants).matchAll(/"([A-Za-z0-9._%\-]+(?:\/[A-Za-z0-9._%\-]+)+)"/g)) {
                const n = normalizeRef(m[1]);
                if (n) refs.add(n);
            }
        }
    } catch (e) {
        report.errors.push(`ref-scan files: ${e instanceof Error ? e.message : String(e)}`);
    }

    return refs;
}

async function* walkFiles(dir: string): AsyncGenerator<string> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walkFiles(full);
        else if (entry.isFile()) yield full;
    }
}

/** Remove now-empty directories bottom-up; top-level folders are kept. */
async function pruneEmptyDirs(dir: string, base: string, report: SweepReport): Promise<boolean> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let empty = true;
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!(await pruneEmptyDirs(full, base, report))) empty = false;
        } else {
            empty = false;
        }
    }
    const rel = path.relative(base, dir);
    const depth = rel === "" ? 0 : rel.split(path.sep).length;
    if (empty && depth >= 2) {
        try {
            await fs.rmdir(dir);
            report.prunedDirs++;
            return true;
        } catch {
            return false;
        }
    }
    return !empty ? false : depth === 0 ? false : true;
}

export async function runStorageSweep(opts: { execute?: boolean; minAgeHours?: number } = {}): Promise<SweepReport> {
    const execute = opts.execute ?? false;
    const minAgeHours = Math.max(1, opts.minAgeHours ?? 24);
    const base = path.resolve(storageConfig.local.uploadDir);

    const report: SweepReport = {
        base,
        execute,
        minAgeHours,
        refPaths: 0,
        columnsScanned: 0,
        scannedFiles: 0,
        scannedBytes: 0,
        excludedFiles: 0,
        tooNew: [],
        orphans: [],
        orphanBytes: 0,
        deletedFiles: 0,
        deletedBytes: 0,
        prunedDirs: 0,
        errors: [],
    };

    const refs = await collectReferencedPaths(report);
    report.refPaths = refs.size;

    const now = Date.now();
    for await (const abs of walkFiles(base)) {
        const rel = path.relative(base, abs).split(path.sep).join("/");
        const top = rel.split("/")[0];
        if (EXCLUDED_TOP.has(top)) {
            report.excludedFiles++;
            continue;
        }
        const stat = await fs.stat(abs);
        report.scannedFiles++;
        report.scannedBytes += stat.size;
        if (refs.has(rel)) continue;

        const ageHours = (now - stat.mtimeMs) / 3_600_000;
        const entry: SweepEntry = {
            rel,
            bytes: stat.size,
            mtime: stat.mtime.toISOString(),
            ageHours: Math.round(ageHours * 10) / 10,
        };
        if (ageHours < minAgeHours) {
            report.tooNew.push(entry);
            continue;
        }
        report.orphans.push(entry);
        report.orphanBytes += stat.size;
    }

    if (execute) {
        // Fail-safe: a near-empty reference set with a populated disk means the
        // DB scan broke — deleting on that basis would wipe live media.
        if (refs.size < 10 && report.scannedFiles > 20) {
            throw new Error(
                `Refusing to execute: only ${refs.size} referenced paths found for ${report.scannedFiles} files on disk`
            );
        }
        for (const orphan of report.orphans) {
            const abs = path.resolve(base, orphan.rel);
            if (!abs.startsWith(base + path.sep)) {
                report.errors.push(`skip outside base: ${orphan.rel}`);
                continue;
            }
            try {
                await fs.unlink(abs);
                report.deletedFiles++;
                report.deletedBytes += orphan.bytes;
            } catch (e) {
                report.errors.push(`unlink ${orphan.rel}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
        await pruneEmptyDirs(base, base, report).catch((e) => {
            report.errors.push(`prune: ${e instanceof Error ? e.message : String(e)}`);
        });
    }

    return report;
}
