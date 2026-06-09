// Baked-in Indonesian administrative-region lookup for KYC NIK screening.
//
// The data ships with the app (src/data/wilayah.json, generated from the
// MIT-licensed cahyadsn/wilayah dataset by scripts/build-wilayah.mjs) and is
// loaded once into the server process — there is NO runtime API call. A NIK
// encodes its first 6 digits as province[2] + regency[2] + district[2]; this
// module resolves that 6-digit code to human-readable names and lets the
// screener confirm the region actually exists.

import wilayahJson from "@/data/wilayah.json";

interface WilayahData {
    meta: {
        source: string;
        decree: string;
        note: string;
        counts: { provinces: number; regencies: number; districts: number };
    };
    provinces: Record<string, string>; // "11"     -> "Aceh"
    regencies: Record<string, string>; // "1101"   -> "Kabupaten Aceh Selatan"
    districts: Record<string, string>; // "110101" -> "Bakongan"
}

// Cast through unknown so the compiler treats the bundled JSON as the clean
// interface rather than inferring a multi-thousand-key literal type.
const data = wilayahJson as unknown as WilayahData;

export interface NikRegion {
    /** The 6-digit district (kecamatan) code. */
    code: string;
    province: string;
    regency: string;
    district: string;
}

/**
 * Resolve the administrative region for a 6-digit district code (e.g. "110101").
 * Returns null if the district code is not present in the dataset.
 */
export function lookupWilayah(code6: string): NikRegion | null {
    const digits = (code6 || "").replace(/\D/g, "");
    if (digits.length < 6) return null;
    const code = digits.slice(0, 6);
    const district = data.districts[code];
    if (!district) return null;
    return {
        code,
        province: data.provinces[code.slice(0, 2)] ?? "",
        regency: data.regencies[code.slice(0, 4)] ?? "",
        district,
    };
}

/** Decode the region encoded in the first 6 digits of a 16-digit NIK. */
export function decodeNikRegion(nik: string): NikRegion | null {
    const digits = (nik || "").replace(/\D/g, "");
    if (digits.length < 6) return null;
    return lookupWilayah(digits.slice(0, 6));
}

/** Provenance + counts for the bundled dataset (shown in ops/debug surfaces). */
export const wilayahMeta = data.meta;
