"use server";

// Async OCR pre-screening for KYC documents. Decoupled from the submit request
// because a single local-LLM call takes ~30s. Three entry points share one core:
//   - runKycOcrSweep()        : background cron worker (feature-flagged, batched)
//   - runKycOcrForSeller(id)  : admin manual "run now" (synchronous, one row)
//   - processKycOcrRow(row)   : the shared per-submission processor
//
// OCR is ADVISORY: it never flips KYC status. It records what the card says,
// cross-checks the seller-typed NIK, and nudges an admin when something looks
// off (not a KTP, or the NIK on the card differs from what was typed).

import { db } from "@/db";
import { files, notifications, seller_kyc, users } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { decryptPdpField } from "@/lib/crypto/pdp-field";
import { getFileUrl, isS3Configured, resolveStoredFilePath } from "@/lib/storage";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { crossCheckNik, extractKtpFromImage, getOcrConfig, isOcrConfigured, KYC_OCR_FEATURE_KEY, type NikVerdict } from "@/lib/kyc-ocr";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 3;

type SellerKycRow = typeof seller_kyc.$inferSelect;
type OcrResult = NonNullable<SellerKycRow["ocr"]>;

export interface OcrRowOutcome {
    status: "DONE" | "FAILED" | "PENDING";
    verdict?: NikVerdict;
    isKtp?: boolean | null;
    error?: string;
}

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    const u = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
        columns: { id: true, role: true },
    });
    if (u?.role !== "ADMIN") throw new Error("Forbidden");
    return u;
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

async function notifyAdminsOfOcrFinding(sellerId: string, storeLabel: string, message: string, verdictKey: string) {
    try {
        const admins = await db.query.users.findMany({ where: eq(users.role, "ADMIN"), columns: { id: true } });
        for (const admin of admins) {
            await db
                .insert(notifications)
                .values({
                    user_id: admin.id,
                    type: "SELLER_REVIEW_NEEDED",
                    title: "Temuan OCR pada KYC Seller",
                    message: `${storeLabel}: ${message}`,
                    idempotency_key: `KYC_OCR_ALERT:${sellerId}:${verdictKey}`,
                    data: { seller_id: sellerId, kind: "ocr_alert", verdict: verdictKey },
                })
                .onConflictDoNothing();
        }
    } catch (e) {
        logger.error?.("kyc-ocr:notify_failed", { sellerId, error: e instanceof Error ? e.message : String(e) });
    }
}

/**
 * Process one KYC submission's KTP image through OCR and persist the result.
 * Never throws — failures are recorded on the row (retryable until MAX_ATTEMPTS).
 * Internal (not a public server action): callers are the sweep + admin run below.
 */
async function processKycOcrRow(row: SellerKycRow): Promise<OcrRowOutcome> {
    const config = getOcrConfig();
    const priorAttempts = row.ocr?.attempts ?? 0;
    const attempts = priorAttempts + 1;
    const now = new Date();

    const fail = async (error: string, retryable: boolean): Promise<OcrRowOutcome> => {
        const exhausted = !retryable || attempts >= MAX_ATTEMPTS;
        const status: OcrResult["status"] = exhausted ? "FAILED" : "PENDING";
        await db
            .update(seller_kyc)
            .set({
                ocr_status: status,
                ocr: {
                    status,
                    attempts,
                    isKtp: row.ocr?.isKtp ?? null,
                    extracted: row.ocr?.extracted ?? null,
                    checks: row.ocr?.checks ?? null,
                    model: config?.model ?? null,
                    error,
                    ranAt: now.toISOString(),
                },
                updated_at: now,
            })
            .where(eq(seller_kyc.user_id, row.user_id));
        return { status: exhausted ? "FAILED" : "PENDING", error };
    };

    if (!config) return fail("OCR endpoint not configured", false);
    if (!row.ktp_file_id) return fail("No KTP file on submission", false);

    let bytes: Buffer;
    let mime = "image/jpeg";
    try {
        const file = await db.query.files.findFirst({
            where: eq(files.id, row.ktp_file_id),
            columns: { storage_key: true, mime_type: true },
        });
        if (!file) return fail("KTP file row not found", false);
        mime = file.mime_type;
        bytes = await readStoredFileBytes(file.storage_key);
    } catch (e) {
        return fail(`read KTP bytes: ${e instanceof Error ? e.message : String(e)}`, true);
    }

    let extraction;
    try {
        extraction = await extractKtpFromImage(bytes, mime);
    } catch (e) {
        return fail(e instanceof Error ? e.message : String(e), true);
    }

    const typedNik = decryptPdpField(row.nik) ?? "";
    const check = crossCheckNik(typedNik, extraction.nik);

    const result: OcrResult = {
        status: "DONE",
        attempts,
        isKtp: extraction.isKtp,
        extracted: { nik: maskNik(extraction.nik), nama: extraction.nama, ttl: extraction.ttl },
        checks: check,
        model: config.model,
        error: null,
        ranAt: now.toISOString(),
    };

    await db
        .update(seller_kyc)
        .set({ ocr_status: "DONE", ocr: result, updated_at: now })
        .where(eq(seller_kyc.user_id, row.user_id));

    // Advisory admin nudges — only on the two findings worth an interrupt.
    const storeLabel = await db.query.users
        .findFirst({ where: eq(users.id, row.user_id), columns: { store_name: true, name: true } })
        .then((u) => u?.store_name || u?.name || "Seller");
    if (extraction.isKtp === false) {
        await notifyAdminsOfOcrFinding(row.user_id, storeLabel, "Dokumen yang diunggah terdeteksi BUKAN KTP.", "not_ktp");
    } else if (check.nikVerdict === "mismatch") {
        await notifyAdminsOfOcrFinding(
            row.user_id,
            storeLabel,
            "NIK pada gambar KTP berbeda dari NIK yang diketik seller.",
            "nik_mismatch"
        );
    }

    return { status: "DONE", verdict: check.nikVerdict, isKtp: extraction.isKtp };
}

export interface KycOcrSweepResult {
    skipped?: "not_configured" | "disabled";
    inspected: number;
    processed: number;
    mismatches: number;
    notKtp: number;
    failed: number;
}

/** Background worker: OCR the oldest PENDING submissions within a time budget. */
export async function runKycOcrSweep(): Promise<KycOcrSweepResult> {
    const base: KycOcrSweepResult = { inspected: 0, processed: 0, mismatches: 0, notKtp: 0, failed: 0 };
    if (!isOcrConfigured()) return { ...base, skipped: "not_configured" };
    if (!(await isFeatureEnabled(KYC_OCR_FEATURE_KEY))) return { ...base, skipped: "disabled" };

    const batch = Math.max(1, Number.parseInt(process.env.KYC_OCR_BATCH || "3", 10) || 3);
    const budgetMs = Math.max(20_000, Number.parseInt(process.env.KYC_OCR_SWEEP_BUDGET_MS || "120000", 10) || 120_000);
    const startedAt = Date.now();

    const rows = await db.query.seller_kyc.findMany({
        where: eq(seller_kyc.ocr_status, "PENDING"),
        orderBy: [asc(seller_kyc.submitted_at)],
        limit: batch,
    });

    for (const row of rows) {
        if (Date.now() - startedAt > budgetMs) break;
        base.inspected++;
        try {
            const outcome = await processKycOcrRow(row);
            if (outcome.status === "DONE") {
                base.processed++;
                if (outcome.isKtp === false) base.notKtp++;
                if (outcome.verdict === "mismatch") base.mismatches++;
            } else if (outcome.status === "FAILED") {
                base.failed++;
            }
        } catch (e) {
            base.failed++;
            logger.error?.("kyc-ocr:sweep_row_failed", {
                sellerId: row.user_id,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    return base;
}

export interface RunOcrForSellerResult {
    ok: boolean;
    status: OcrRowOutcome["status"];
    verdict?: OcrRowOutcome["verdict"];
    isKtp?: boolean | null;
    error?: string;
}

/** Admin "Run OCR now" — synchronous single-row run (works even if the sweep flag is off). */
export async function runKycOcrForSeller(sellerId: string): Promise<RunOcrForSellerResult> {
    await requireAdmin();
    if (!isOcrConfigured()) {
        throw new Error("Endpoint OCR belum dikonfigurasi (KYC_OCR_LLM_URL / KYC_OCR_LLM_MODEL).");
    }
    const row = await db.query.seller_kyc.findFirst({
        where: and(eq(seller_kyc.user_id, sellerId)),
    });
    if (!row) throw new Error("Pengajuan KYC tidak ditemukan.");
    if (!row.ktp_file_id) throw new Error("Pengajuan ini tidak memiliki berkas KTP.");

    const outcome = await processKycOcrRow(row);
    revalidatePath("/admin/kyc");
    return { ok: outcome.status === "DONE", status: outcome.status, verdict: outcome.verdict, isKtp: outcome.isKtp, error: outcome.error };
}
