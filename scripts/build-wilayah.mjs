// Build the baked-in Indonesian administrative-region lookup used by KYC NIK
// screening, from the cahyadsn/wilayah dataset (MIT, tracks the latest
// Kepmendagri decree).
//
// This is a ONE-TIME / on-demand generator — NOT a runtime API call. Run it
// whenever Kemendagri issues a new wilayah decree to refresh the snapshot:
//
//     node scripts/build-wilayah.mjs
//
// It downloads db/wilayah.sql, keeps only province/regency/district levels
// (a NIK encodes 6 digits = province[2] + regency[2] + district[2]; villages
// are dropped), and writes a compact JSON keyed by dot-less codes.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql";
const DECREE = "Kepmendagri (via cahyadsn/wilayah, MIT)";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "src", "data", "wilayah.json");

async function main() {
    console.log(`Downloading ${SOURCE_URL} ...`);
    const res = await fetch(SOURCE_URL);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const sql = await res.text();
    console.log(`Downloaded ${(sql.length / 1024 / 1024).toFixed(1)} MB`);

    const provinces = {}; // "11"      -> "Aceh"
    const regencies = {}; // "1101"    -> "Kabupaten Aceh Selatan"
    const districts = {}; // "110101"  -> "Bakongan"

    // Each data row is a single line: ('11.01','Kabupaten Aceh Selatan'),
    const rowRe = /^\('([0-9.]+)','((?:[^'\\]|\\.)*)'\),?$/;
    let lineCount = 0;
    for (const rawLine of sql.split("\n")) {
        const line = rawLine.trim();
        const m = rowRe.exec(line);
        if (!m) continue;
        lineCount++;
        const code = m[1];
        const nama = m[2].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
        const dots = (code.match(/\./g) || []).length;
        const flat = code.replace(/\./g, "");
        if (dots === 0 && flat.length === 2) provinces[flat] = nama;
        else if (dots === 1 && flat.length === 4) regencies[flat] = nama;
        else if (dots === 2 && flat.length === 6) districts[flat] = nama;
        // dots >= 3 => village/desa: skipped (not encoded in a NIK)
    }

    const out = {
        meta: {
            source: SOURCE_URL,
            decree: DECREE,
            note: "Regenerate with `node scripts/build-wilayah.mjs` when a new Kepmendagri wilayah decree is published.",
            counts: {
                provinces: Object.keys(provinces).length,
                regencies: Object.keys(regencies).length,
                districts: Object.keys(districts).length,
            },
        },
        provinces,
        regencies,
        districts,
    };

    if (out.meta.counts.provinces < 30 || out.meta.counts.districts < 6000) {
        throw new Error(
            `Sanity check failed — parsed too few rows (provinces=${out.meta.counts.provinces}, districts=${out.meta.counts.districts}). Format may have changed; aborting without writing.`
        );
    }

    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, JSON.stringify(out));
    console.log(`Matched ${lineCount} data rows.`);
    console.log(
        `Wrote ${OUT_PATH}: ${out.meta.counts.provinces} provinces, ${out.meta.counts.regencies} regencies, ${out.meta.counts.districts} districts.`
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
