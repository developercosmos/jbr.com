// Core KTP-OCR processors. Lives in lib/ (NOT a "use server" actions file) so it
// can be imported by the public entry points without itself becoming a
// publicly-invokable server action:
//   - src/actions/kyc.ts        : instant kick after seller-KYC submit
//   - src/actions/affiliate.ts  : instant kick after affiliate enrollment
//   - src/actions/kyc-ocr.ts    : cron sweeps (retry/backstop) + admin manual runs
//
// OCR is ADVISORY: it never flips a review status. It records what the card
// says, cross-checks the typed NIK, and nudges an admin when something looks
// off (not a KTP, or the NIK on the card differs from what was typed).

import { db } from "@/db";
import { affiliate_accounts, files, notifications, seller_kyc, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import { decryptPdpField } from "@/lib/crypto/pdp-field";
import { getFileUrl, isS3Configured, resolveStoredFilePath } from "@/lib/storage";
import { crossCheckNik, extractKtpFromImage, getOcrConfig, type NikVerdict } from "@/lib/kyc-ocr";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 3;

export type SellerKycRow = typeof seller_kyc.$inferSelect;
export type AffiliateAccountRow = typeof affiliate_accounts.$inferSelect;
// Both tables share the exact same ocr jsonb shape.
type OcrResult = NonNullable<SellerKycRow["ocr"]>;

export interface OcrRowOutcome {
    status: "DONE" | "FAILED" | "PENDING";
    verdict?: NikVerdict;
    isKtp?: boolean | null;
    error?: string;
}

/** Read a stored file's raw bytes (local disk or S3 presigned fetch). */
async function readStoredFileBytes(storageKey: string): Promise<Buffer> {
    if (isS3Configured()) {
        const url = await getFileUrl(storageKey, 600);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`fetch file bytes HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
    }
    return fs.readFile(resolveStoredFilePath(storageKey));
}

/** Mask all but the area prefix (6) and last 2 digits, so no second plaintext NIK lands at rest. */
function maskNik(nik: string | null): string | null {
    const d = (nik || "").replace(/\D/g, "");
    if (d.length !== 16) return null;
    return `${d.slice(0, 6)}${"*".repeat(8)}${d.slice(14)}`;
}

async function notifyAdminsOfOcrFinding(
    subjectUserId: string,
    subjectLabel: string,
    message: string,
    idempotencyKey: string
) {
    try {
        const admins = await db.query.users.findMany({ where: eq(users.role, "ADMIN"), columns: { id: true } });
        for (const admin of admins) {
            await db
                .insert(notifications)
                .values({
                    user_id: admin.id,
                    type: "SELLER_REVIEW_NEEDED",
                    title: "Temuan OCR pada Dokumen KTP",
                    message: `${subjectLabel}: ${message}`,
                    idempotency_key: `${idempotencyKey}:${admin.id}`,
                    data: { subject_user_id: subjectUserId, kind: "ocr_alert" },
                })
                .onConflictDoNothing();
        }
    } catch (e) {
        logger.error?.("kyc-ocr:notify_failed", { subjectUserId, error: e instanceof Error ? e.message : String(e) });
    }
}

interface KtpOcrSuccess {
    ok: true;
    isKtp: boolean | null;
    extracted: { nik: string | null; nama: string | null; ttl: string | null };
    checks: { nikVerdict: NikVerdict; nikDistance: number | null };
}

interface KtpOcrFailure {
    ok: false;
    error: string;
    retryable: boolean;
}

/**
 * Shared core: load the KTP file, run the LLM extraction, cross-check the
 * typed (encrypted) NIK. No table writes — callers persist per-table.
 */
async function executeKtpOcr(ktpFileId: string | null, encryptedTypedNik: string | null): Promise<KtpOcrSuccess | KtpOcrFailure> {
    if (!ktpFileId) return { ok: false, error: "No KTP file on submission", retryable: false };

    let bytes: Buffer;
    let mime = "image/jpeg";
    try {
        const file = await db.query.files.findFirst({
            where: eq(files.id, ktpFileId),
            columns: { storage_key: true, mime_type: true },
        });
        if (!file) return { ok: false, error: "KTP file row not found", retryable: false };
        mime = file.mime_type;
        bytes = await readStoredFileBytes(file.storage_key);
    } catch (e) {
        return { ok: false, error: `read KTP bytes: ${e instanceof Error ? e.message : String(e)}`, retryable: true };
    }

    let extraction;
    try {
        extraction = await extractKtpFromImage(bytes, mime);
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e), retryable: true };
    }

    const typedNik = decryptPdpField(encryptedTypedNik) ?? "";
    const check = crossCheckNik(typedNik, extraction.nik);

    return {
        ok: true,
        isKtp: extraction.isKtp,
        extracted: { nik: maskNik(extraction.nik), nama: extraction.nama, ttl: extraction.ttl },
        checks: check,
    };
}

function buildFailedOcr(prior: OcrResult | null, attempts: number, error: string, retryable: boolean, model: string | null, now: Date): { status: "FAILED" | "PENDING"; ocr: OcrResult } {
    const exhausted = !retryable || attempts >= MAX_ATTEMPTS;
    const status = exhausted ? ("FAILED" as const) : ("PENDING" as const);
    return {
        status,
        ocr: {
            status,
            attempts,
            isKtp: prior?.isKtp ?? null,
            extracted: prior?.extracted ?? null,
            checks: prior?.checks ?? null,
            model,
            error,
            ranAt: now.toISOString(),
        },
    };
}

function buildDoneOcr(result: KtpOcrSuccess, attempts: number, model: string | null, now: Date): OcrResult {
    return {
        status: "DONE",
        attempts,
        isKtp: result.isKtp,
        extracted: result.extracted,
        checks: result.checks,
        model,
        error: null,
        ranAt: now.toISOString(),
    };
}

/**
 * Process one seller-KYC submission's KTP through OCR and persist the result.
 * Never throws — failures are recorded on the row (retryable until MAX_ATTEMPTS).
 */
export async function processKycOcrRow(row: SellerKycRow): Promise<OcrRowOutcome> {
    const config = getOcrConfig();
    const attempts = (row.ocr?.attempts ?? 0) + 1;
    const now = new Date();

    if (!config) {
        const failed = buildFailedOcr(row.ocr, attempts, "OCR endpoint not configured", false, null, now);
        await db.update(seller_kyc).set({ ocr_status: failed.status, ocr: failed.ocr, updated_at: now }).where(eq(seller_kyc.user_id, row.user_id));
        return { status: failed.status, error: failed.ocr.error ?? undefined };
    }

    const result = await executeKtpOcr(row.ktp_file_id, row.nik);
    if (!result.ok) {
        const failed = buildFailedOcr(row.ocr, attempts, result.error, result.retryable, config.model, now);
        await db.update(seller_kyc).set({ ocr_status: failed.status, ocr: failed.ocr, updated_at: now }).where(eq(seller_kyc.user_id, row.user_id));
        return { status: failed.status, error: result.error };
    }

    const done = buildDoneOcr(result, attempts, config.model, now);
    await db.update(seller_kyc).set({ ocr_status: "DONE", ocr: done, updated_at: now }).where(eq(seller_kyc.user_id, row.user_id));

    const label = await db.query.users
        .findFirst({ where: eq(users.id, row.user_id), columns: { store_name: true, name: true } })
        .then((u) => `KYC seller ${u?.store_name || u?.name || row.user_id}`);
    if (result.isKtp === false) {
        await notifyAdminsOfOcrFinding(row.user_id, label, "Dokumen yang diunggah terdeteksi BUKAN KTP.", `KYC_OCR_ALERT:${row.user_id}:not_ktp`);
    } else if (result.checks.nikVerdict === "mismatch") {
        await notifyAdminsOfOcrFinding(row.user_id, label, "NIK pada gambar KTP berbeda dari NIK yang diketik.", `KYC_OCR_ALERT:${row.user_id}:nik_mismatch`);
    }

    return { status: "DONE", verdict: result.checks.nikVerdict, isKtp: result.isKtp };
}

/**
 * Process one affiliate enrollment's KTP through OCR and persist the result.
 * Same contract as processKycOcrRow, writing to affiliate_accounts.
 */
export async function processAffiliateOcrRow(row: AffiliateAccountRow): Promise<OcrRowOutcome> {
    const config = getOcrConfig();
    const attempts = (row.ocr?.attempts ?? 0) + 1;
    const now = new Date();

    if (!config) {
        const failed = buildFailedOcr(row.ocr, attempts, "OCR endpoint not configured", false, null, now);
        await db.update(affiliate_accounts).set({ ocr_status: failed.status, ocr: failed.ocr, updated_at: now }).where(eq(affiliate_accounts.user_id, row.user_id));
        return { status: failed.status, error: failed.ocr.error ?? undefined };
    }

    const result = await executeKtpOcr(row.ktp_file_id, row.nik);
    if (!result.ok) {
        const failed = buildFailedOcr(row.ocr, attempts, result.error, result.retryable, config.model, now);
        await db.update(affiliate_accounts).set({ ocr_status: failed.status, ocr: failed.ocr, updated_at: now }).where(eq(affiliate_accounts.user_id, row.user_id));
        return { status: failed.status, error: result.error };
    }

    const done = buildDoneOcr(result, attempts, config.model, now);
    await db.update(affiliate_accounts).set({ ocr_status: "DONE", ocr: done, updated_at: now }).where(eq(affiliate_accounts.user_id, row.user_id));

    const label = `Affiliate ${row.full_name || row.code}`;
    if (result.isKtp === false) {
        await notifyAdminsOfOcrFinding(row.user_id, label, "Dokumen yang diunggah terdeteksi BUKAN KTP.", `AFFILIATE_OCR_ALERT:${row.user_id}:not_ktp`);
    } else if (result.checks.nikVerdict === "mismatch") {
        await notifyAdminsOfOcrFinding(row.user_id, label, "NIK pada gambar KTP berbeda dari NIK yang diketik.", `AFFILIATE_OCR_ALERT:${row.user_id}:nik_mismatch`);
    }

    return { status: "DONE", verdict: result.checks.nikVerdict, isKtp: result.isKtp };
}
