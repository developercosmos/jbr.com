"use server";

// Public entry points for the async KYC OCR pre-screen. The core per-row
// processor lives in src/lib/kyc-ocr-runner.ts (shared with the instant kick in
// submitSellerKycApplication); this file exposes only:
//   - runKycOcrSweep()        : cron worker — retry/backstop for kicks that died
//   - runKycOcrForSeller(id)  : admin manual "run now" (synchronous, one row)

import { db } from "@/db";
import { seller_kyc, users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isOcrConfigured, KYC_OCR_FEATURE_KEY } from "@/lib/kyc-ocr";
import { processKycOcrRow, type OcrRowOutcome } from "@/lib/kyc-ocr-runner";
import { logger } from "@/lib/logger";

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
        where: eq(seller_kyc.user_id, sellerId),
    });
    if (!row) throw new Error("Pengajuan KYC tidak ditemukan.");
    if (!row.ktp_file_id) throw new Error("Pengajuan ini tidak memiliki berkas KTP.");

    const outcome = await processKycOcrRow(row);
    revalidatePath("/admin/kyc");
    return { ok: outcome.status === "DONE", status: outcome.status, verdict: outcome.verdict, isKtp: outcome.isKtp, error: outcome.error };
}
