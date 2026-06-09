// In-house preliminary KYC screening. Pure module (no DB/server imports) so it can
// be unit-reasoned and shared. The server action gathers the inputs (file hashes,
// duplicate counts, resolved NIK region) and calls runKycScreening(); the result is
// stored on seller_kyc.screening and shown to the admin reviewer.
//
// `NikRegion` is imported as a type only (erased at compile time), so the bundled
// wilayah dataset is NOT pulled into this pure module.
import type { NikRegion } from "./wilayah";

export type KycFlagSeverity = "low" | "medium" | "high";

export interface KycFlag {
    code: string;
    severity: KycFlagSeverity;
    message: string;
}

export interface KycScreeningResult {
    riskLevel: "low" | "medium" | "high";
    score: number; // 0–100, higher = riskier
    autoReject: boolean;
    flags: KycFlag[];
    region: NikRegion | null; // resolved from the NIK's 6-digit prefix (null = not found / not looked up)
    ranAt: string; // ISO timestamp
}

// Indonesian province codes (first 2 digits of NIK). Assigned codes run 11–96
// after the 2022 Papua expansion; we accept 11–96 as a generous plausibility
// range here. The authoritative existence check is the wilayah region lookup
// (NIK_REGION_UNKNOWN), passed in via the screening input.
export function validateNik(raw: string): { valid: boolean; reason?: string; dob?: string } {
    const nik = (raw || "").replace(/\D/g, "");
    if (nik.length !== 16) {
        return { valid: false, reason: "NIK harus 16 digit angka." };
    }
    const province = parseInt(nik.slice(0, 2), 10);
    if (!(province >= 11 && province <= 96)) {
        return { valid: false, reason: "Kode provinsi pada NIK tidak valid." };
    }
    const regency = parseInt(nik.slice(2, 4), 10);
    const district = parseInt(nik.slice(4, 6), 10);
    if (regency < 1 || district < 1) {
        return { valid: false, reason: "Kode wilayah pada NIK tidak valid." };
    }
    // Digits 7–12 encode the birth date as DDMMYY; for women DD is +40.
    let dd = parseInt(nik.slice(6, 8), 10);
    const mm = parseInt(nik.slice(8, 10), 10);
    const yy = nik.slice(10, 12);
    if (dd > 40) dd -= 40;
    if (!(dd >= 1 && dd <= 31) || !(mm >= 1 && mm <= 12)) {
        return { valid: false, reason: "Tanggal lahir yang ter-encode pada NIK tidak valid." };
    }
    if (nik.slice(12) === "0000") {
        return { valid: false, reason: "Nomor urut pada NIK tidak valid." };
    }
    return { valid: true, dob: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}/${yy}` };
}

const MIN_IMAGE_BYTES = 15_000; // images smaller than this are likely blank/unreadable

export interface KycScreeningInput {
    nikValidation: { valid: boolean; reason?: string };
    ktp: { mime: string; size: number; contentHash: string | null };
    selfie: { mime: string; size: number; contentHash: string | null };
    /** OTHER accounts that uploaded a byte-identical KTP/selfie. */
    duplicateDocAccountCount: number;
    /** OTHER accounts that submitted the same NIK. */
    duplicateNikAccountCount: number;
    /**
     * Region resolved from the NIK's 6-digit prefix via the wilayah dataset.
     * `null` = a lookup was done but the code is not a real district (flagged);
     * `undefined` = no lookup attempted (no flag).
     */
    region?: NikRegion | null;
}

export function runKycScreening(input: KycScreeningInput): KycScreeningResult {
    const flags: KycFlag[] = [];

    if (!input.ktp.mime.startsWith("image/")) {
        flags.push({ code: "KTP_NOT_IMAGE", severity: "high", message: "Berkas KTP bukan gambar yang valid." });
    } else if (input.ktp.size < MIN_IMAGE_BYTES) {
        flags.push({ code: "KTP_TOO_SMALL", severity: "medium", message: "Gambar KTP sangat kecil — kemungkinan buram/tidak terbaca." });
    }

    if (!input.selfie.mime.startsWith("image/")) {
        flags.push({ code: "SELFIE_NOT_IMAGE", severity: "high", message: "Berkas selfie bukan gambar yang valid." });
    } else if (input.selfie.size < MIN_IMAGE_BYTES) {
        flags.push({ code: "SELFIE_TOO_SMALL", severity: "medium", message: "Gambar selfie sangat kecil — kemungkinan buram/tidak terbaca." });
    }

    if (input.ktp.contentHash && input.ktp.contentHash === input.selfie.contentHash) {
        flags.push({ code: "KTP_SELFIE_SAME_IMAGE", severity: "high", message: "KTP dan selfie adalah berkas yang sama persis." });
    }

    if (input.duplicateDocAccountCount > 0) {
        flags.push({
            code: "DUPLICATE_DOCUMENT",
            severity: "high",
            message: `Dokumen identik sudah dipakai oleh ${input.duplicateDocAccountCount} akun lain.`,
        });
    }

    if (!input.nikValidation.valid) {
        flags.push({ code: "NIK_INVALID", severity: "medium", message: input.nikValidation.reason || "NIK tidak valid." });
    }

    // Region existence: null means a lookup ran and the 6-digit code is not a
    // real district. Flagged (not auto-rejected) because our wilayah snapshot can
    // lag a brand-new Kepmendagri decree.
    if (input.region === null) {
        flags.push({
            code: "NIK_REGION_UNKNOWN",
            severity: "medium",
            message: "Kode wilayah (6 digit awal NIK) tidak ditemukan di basis data wilayah.",
        });
    }

    if (input.duplicateNikAccountCount > 0) {
        flags.push({
            code: "DUPLICATE_NIK",
            severity: "high",
            message: `NIK ini sudah dipakai oleh ${input.duplicateNikAccountCount} akun lain.`,
        });
    }

    const score = Math.min(
        100,
        flags.reduce((sum, f) => sum + (f.severity === "high" ? 40 : f.severity === "medium" ? 15 : 5), 0)
    );
    const riskLevel: KycScreeningResult["riskLevel"] = flags.some((f) => f.severity === "high")
        ? "high"
        : flags.some((f) => f.severity === "medium")
            ? "medium"
            : "low";

    // Auto-reject only on clear fraud / unusable docs. Soft issues (e.g. NIK format,
    // small image) are flagged for the admin but NOT auto-rejected.
    const AUTO_REJECT_CODES = new Set(["KTP_NOT_IMAGE", "SELFIE_NOT_IMAGE", "KTP_SELFIE_SAME_IMAGE", "DUPLICATE_DOCUMENT", "DUPLICATE_NIK"]);
    const autoReject = flags.some((f) => AUTO_REJECT_CODES.has(f.code));

    return { riskLevel, score, autoReject, flags, region: input.region ?? null, ranAt: new Date().toISOString() };
}
