"use server";

import { db } from "@/db";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import {
    affiliate_accounts,
    affiliate_attributions,
    affiliate_clicks,
    files,
    notifications,
    orders,
    seller_kyc,
    users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { after } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    postAffiliateCommissionAccrual,
    postAffiliateCommissionReverse,
    postAffiliatePayment,
} from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { logger } from "@/lib/logger";
import { decryptPdpField, encryptPdpField } from "@/lib/crypto/pdp-field";
import { sendAffiliateApprovedEmail, sendAffiliateRejectedEmail } from "@/lib/email";
import { AFFILIATE_OCR_FEATURE_KEY, isOcrConfigured } from "@/lib/kyc-ocr";
import { processAffiliateOcrRow } from "@/lib/kyc-ocr-runner";
import { isFeatureEnabled } from "@/lib/feature-flags";

const ATTRIBUTION_WINDOW_DAYS = Number(process.env.AFFILIATE_ATTRIBUTION_DAYS || 30);
const DEFAULT_COMMISSION_RATE = Number(process.env.AFFILIATE_DEFAULT_RATE || 5);
const AFFILIATE_COOKIE = "jbr_aff";
const RESERVED_CODES = new Set(["admin", "api", "seller", "buyer", "support", "auth"]);

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

async function requireAdmin() {
    const user = await getCurrentUser();
    const admin = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, role: true },
    });
    if (!admin || admin.role !== "ADMIN") throw new Error("Admin access required");
    return admin;
}

function generateCodeFromName(name: string): string {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 8);
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base || "aff"}${suffix}`;
    return RESERVED_CODES.has(candidate) ? `${candidate}1` : candidate;
}

async function resolveAffiliateCode(desiredCode: string | undefined, userName: string | null, excludeUserId?: string) {
    let code = desiredCode
        ? desiredCode.toLowerCase()
        : generateCodeFromName(userName || "aff");

    if (RESERVED_CODES.has(code)) code = `${code}1`;

    for (let i = 0; i < 8; i++) {
        const conflict = await db.query.affiliate_accounts.findFirst({
            where: eq(affiliate_accounts.code, code),
            columns: { user_id: true },
        });

        if (!conflict || conflict.user_id === excludeUserId) {
            return code;
        }

        code = generateCodeFromName(`${userName || "aff"}${i}`);
    }

    throw new Error("Gagal membuat kode referral unik. Silakan coba lagi.");
}

const enrollSchema = z.object({
    payoutMethod: z.string().max(40).optional(),
    payoutAccount: z.string().max(120).optional(),
    fullName: z.string().max(120).optional(),
    nik: z
        .string()
        .max(20)
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => v.length === 16, "NIK harus 16 digit angka.")
        .optional(),
    phone: z.string().max(20).optional(),
    instagramHandle: z.string().max(80).optional(),
    /** Legacy public-URL KTP (old uploads only — new submissions send ktpFileId). */
    ktpUrl: z.string().max(512).optional(),
    /** Private files-row id from uploadKycDocument (slot "ktp"). */
    ktpFileId: z.string().uuid().optional(),
    /** Legacy public-URL Surat Pernyataan (old uploads only). */
    statementUrl: z.string().max(512).optional(),
    /** Private files-row id from uploadKycDocument (slot "statement"). */
    statementFileId: z.string().uuid().optional(),
    bankName: z.string().max(60).optional(),
    bankAccountNumber: z.string().max(40).optional(),
    bankAccountName: z.string().max(120).optional(),
    referralCode: z.string().min(5).max(20).regex(/^[a-z0-9]+$/i).optional(),
});

export async function enrollAffiliate(input: z.infer<typeof enrollSchema>) {
    try {
        return await enrollAffiliateInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal mendaftar affiliate.");
        logger.warn("affiliate:enroll_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function enrollAffiliateInternal(input: z.infer<typeof enrollSchema>) {
    const user = await getCurrentUser();
    const validated = enrollSchema.parse(input);

    const existing = await db.query.affiliate_accounts.findFirst({
        where: eq(affiliate_accounts.user_id, user.id),
    });

    if (existing?.status === "ACTIVE" || existing?.status === "PENDING") {
        return { success: true as const, code: existing.code, alreadyEnrolled: true };
    }

    if (existing?.status === "SUSPENDED") {
        throw new Error("Akun affiliate Anda sedang disuspend. Hubungi admin untuk bantuan lebih lanjut.");
    }

    const code = await resolveAffiliateCode(validated.referralCode, user.name, existing?.user_id);

    // New flow: identity docs are PRIVATE files rows (uploaded via
    // uploadKycDocument). Verify ownership + privacy before linking them.
    const assertOwnPrivateFile = async (fileId: string, label: string, allowPdf: boolean) => {
        const fileRow = await db.query.files.findFirst({
            where: eq(files.id, fileId),
            columns: { id: true, uploaded_by: true, is_public: true, mime_type: true },
        });
        if (!fileRow || fileRow.uploaded_by !== user.id || fileRow.is_public) {
            throw new Error(`Berkas ${label} harus berupa file privat milik akun Anda sendiri.`);
        }
        const okMime = fileRow.mime_type.startsWith("image/") || (allowPdf && fileRow.mime_type === "application/pdf");
        if (!okMime) {
            throw new Error(`Format berkas ${label} tidak didukung.`);
        }
    };
    if (validated.ktpFileId) await assertOwnPrivateFile(validated.ktpFileId, "KTP", false);
    if (validated.statementFileId) await assertOwnPrivateFile(validated.statementFileId, "Surat Pernyataan", true);

    const effectiveKtpFileId = validated.ktpFileId ?? existing?.ktp_file_id ?? null;
    const effectiveStatementFileId = validated.statementFileId ?? existing?.statement_file_id ?? null;

    // Queue async OCR (advisory) when there's a private KTP + typed NIK and the
    // feature is on + endpoint configured. The after() kick below processes it
    // right away; the cron sweep is the retry/backstop.
    const ocrShouldQueue =
        !!effectiveKtpFileId && !!validated.nik && isOcrConfigured() && (await isFeatureEnabled(AFFILIATE_OCR_FEATURE_KEY));

    const payload = {
        code,
        status: "PENDING" as const,
        payout_method: validated.payoutMethod,
        payout_account: encryptPdpField(validated.payoutAccount),
        full_name: validated.fullName,
        nik: encryptPdpField(validated.nik),
        phone: validated.phone,
        instagram_handle: validated.instagramHandle,
        // Once a private file exists, stop carrying the legacy public URL.
        ktp_url: effectiveKtpFileId ? null : validated.ktpUrl,
        ktp_file_id: effectiveKtpFileId,
        statement_url: effectiveStatementFileId ? null : validated.statementUrl,
        statement_file_id: effectiveStatementFileId,
        bank_name: validated.bankName,
        bank_account_number: encryptPdpField(validated.bankAccountNumber),
        bank_account_name: validated.bankAccountName,
        review_notes: null,
        reviewed_at: null,
        reviewer_id: null,
        ocr_status: ocrShouldQueue ? ("PENDING" as const) : null,
        ocr: ocrShouldQueue
            ? {
                  status: "PENDING" as const,
                  attempts: 0,
                  isKtp: null,
                  extracted: null,
                  checks: null,
                  model: null,
                  error: null,
                  ranAt: null,
              }
            : null,
        updated_at: new Date(),
    };

    const [saved] = existing
        ? await db
            .update(affiliate_accounts)
            .set(payload)
            .where(eq(affiliate_accounts.user_id, user.id))
            .returning()
        : await db
            .insert(affiliate_accounts)
            .values({
                user_id: user.id,
                ...payload,
            })
            .returning();

    // Instant OCR kick post-response (seller never waits on the ~30s LLM call).
    if (ocrShouldQueue && saved) {
        after(async () => {
            try {
                await processAffiliateOcrRow(saved);
            } catch (e) {
                console.error("[enrollAffiliate] OCR kick failed (cron sweep will retry):", e);
            }
        });
    }

    const admins = await db.query.users.findMany({
        where: eq(users.role, "ADMIN"),
        columns: { id: true },
    });

    await Promise.all(
        admins.map((admin) =>
            db.insert(notifications).values({
                user_id: admin.id,
                type: "SYSTEM",
                title: "Pengajuan Affiliate Baru",
                message: `${validated.fullName || user.name || user.email} mengajukan akun affiliate dan menunggu review admin.`,
                idempotency_key: `AFFILIATE_REVIEW_NEEDED:${user.id}:${Date.now()}:${admin.id}`,
                data: {
                    affiliate_user_id: user.id,
                    code,
                },
            })
        )
    );

    revalidatePath("/affiliate");
    revalidatePath("/admin/affiliates");
    return { success: true as const, code: saved.code };
}

export async function recordAffiliateClick(opts: {
    code: string;
    referrer?: string;
    landingUrl?: string;
    ip?: string;
    userAgent?: string;
}) {
    const account = await db.query.affiliate_accounts.findFirst({
        where: and(eq(affiliate_accounts.code, opts.code), eq(affiliate_accounts.status, "ACTIVE")),
        columns: { user_id: true },
    });
    if (!account) return { success: false, reason: "code_not_active" };

    const expires = new Date(Date.now() + ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(affiliate_clicks).values({
        code: opts.code,
        referrer: opts.referrer,
        landing_url: opts.landingUrl,
        ip: opts.ip,
        user_agent: opts.userAgent,
        expires_at: expires,
    });

    return { success: true as const };
}

/**
 * Hooked into createOrderFromCart: read affiliate cookie and create a PENDING
 * attribution row (status flips to CLEARED on order completion via cron sweep).
 * Self-purchase blocked by checking buyer is not the affiliate owner.
 */
export async function tryAttributeOrderFromCookie(orderId: string, buyerId: string, orderTotal: number) {
    const cookieStore = await cookies();
    const code = cookieStore.get(AFFILIATE_COOKIE)?.value;
    if (!code) return { attributed: false, reason: "no_cookie" };

    const account = await db.query.affiliate_accounts.findFirst({
        where: and(eq(affiliate_accounts.code, code), eq(affiliate_accounts.status, "ACTIVE")),
        columns: { user_id: true, commission_rate_override: true },
    });
    if (!account) return { attributed: false, reason: "code_not_active" };
    if (account.user_id === buyerId) return { attributed: false, reason: "self_purchase" };

    const ratePercent = Number(account.commission_rate_override ?? DEFAULT_COMMISSION_RATE);
    const commission = Math.round((orderTotal * ratePercent) / 100);

    await db
        .insert(affiliate_attributions)
        .values({
            order_id: orderId,
            affiliate_user_id: account.user_id,
            code,
            computed_commission: String(commission),
            rate_used: String(ratePercent),
            status: "PENDING",
        })
        .onConflictDoNothing();

    return { attributed: true, commission, rate: ratePercent };
}

/**
 * Cron-driven: clear attributions whose order has reached COMPLETED.
 */
export async function clearAttributionsForCompletedOrders() {
    const pending = await db
        .select({
            id: affiliate_attributions.id,
            orderId: affiliate_attributions.order_id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
        })
        .from(affiliate_attributions)
        .innerJoin(orders, eq(orders.id, affiliate_attributions.order_id))
        .where(and(eq(affiliate_attributions.status, "PENDING"), eq(orders.status, "COMPLETED")));

    let cleared = 0;
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    for (const row of pending) {
        const updated = await db
            .update(affiliate_attributions)
            .set({ status: "CLEARED", decided_at: new Date() })
            .where(and(eq(affiliate_attributions.id, row.id), eq(affiliate_attributions.status, "PENDING")))
            .returning({ id: affiliate_attributions.id });
        if (updated[0]) {
            cleared++;
            // GL-12: accrue commission expense once attribution is CLEARED.
            if (dualWrite) {
                const amount = Number(row.commission || 0);
                if (amount > 0) {
                    try {
                        await postAffiliateCommissionAccrual({
                            attributionId: row.id,
                            affiliateUserId: row.affiliateUserId,
                            orderId: row.orderId,
                            commission: amount,
                        });
                    } catch (glError) {
                        logger.error("gl:post_affiliate_accrual_failed", {
                            attributionId: row.id,
                            error: String(glError),
                        });
                    }
                }
            }
        }
    }

    return { inspected: pending.length, cleared };
}

export async function reverseAttributionForRefund(orderId: string, memo?: string) {
    const rows = await db
        .select({
            id: affiliate_attributions.id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
            status: affiliate_attributions.status,
        })
        .from(affiliate_attributions)
        .where(eq(affiliate_attributions.order_id, orderId));

    await db
        .update(affiliate_attributions)
        .set({ status: "REVERSED", decided_at: new Date(), memo })
        .where(eq(affiliate_attributions.order_id, orderId));

    // GL-12: reverse only rows that had been CLEARED (i.e., already accrued).
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        for (const row of rows) {
            if (row.status !== "CLEARED") continue;
            const amount = Number(row.commission || 0);
            if (amount <= 0) continue;
            try {
                await postAffiliateCommissionReverse({
                    attributionId: row.id,
                    affiliateUserId: row.affiliateUserId,
                    commission: amount,
                });
            } catch (glError) {
                logger.error("gl:post_affiliate_reverse_failed", {
                    attributionId: row.id,
                    error: String(glError),
                });
            }
        }
    }
}

export async function getAffiliateDashboard() {
    const user = await getCurrentUser();

    // Fetch account, user profile, and KYC in parallel for pre-fill
    const [account, userProfile, kycRecord] = await Promise.all([
        db.query.affiliate_accounts.findFirst({
            where: eq(affiliate_accounts.user_id, user.id),
        }),
        db.query.users.findFirst({
            where: eq(users.id, user.id),
            columns: { name: true, phone: true },
        }),
        db.query.seller_kyc.findFirst({
            where: eq(seller_kyc.user_id, user.id),
            columns: { status: true, ktp_file_id: true },
        }),
    ]);

    // Auto-generate a candidate referral code to suggest to the user
    const suggestedCode = generateCodeFromName(user.name || "aff");

    const prefill = {
        name: userProfile?.name ?? null,
        phone: userProfile?.phone ?? null,
        kycStatus: kycRecord?.status ?? null,
        kycHasKtp: !!kycRecord?.ktp_file_id,
        suggestedCode,
    };

    if (!account) {
        return {
            account: null as null | {
                code: string;
                status: string;
                reviewNotes: string | null;
                reviewedAt: string | null;
                payoutMethod: string | null;
                payoutAccount: string | null;
                fullName: string | null;
                nik: string | null;
                phone: string | null;
                instagramHandle: string | null;
                ktpUrl: string | null;
                ktpFileId: string | null;
                statementUrl: string | null;
                statementFileId: string | null;
                bankName: string | null;
                bankAccountNumber: string | null;
                bankAccountName: string | null;
            },
            prefill,
            totals: { clicks: 0, conversions: 0, pending: 0, cleared: 0, reversed: 0 },
            attributions: [] as Array<{
                id: string;
                orderId: string;
                commission: number;
                rate: number;
                status: string;
                createdAt: string;
            }>,
        };
    }

    const [clickCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(affiliate_clicks)
        .where(eq(affiliate_clicks.code, account.code));

    const aggregates = await db
        .select({
            status: affiliate_attributions.status,
            count: sql<number>`count(*)`,
            commission: sql<string>`coalesce(sum(${affiliate_attributions.computed_commission}), 0)`,
        })
        .from(affiliate_attributions)
        .where(eq(affiliate_attributions.affiliate_user_id, user.id))
        .groupBy(affiliate_attributions.status);

    const totals = aggregates.reduce(
        (acc, row) => {
            const count = Number(row.count);
            const commission = Number(row.commission);
            acc.conversions += count;
            if (row.status === "PENDING") acc.pending += commission;
            if (row.status === "CLEARED") acc.cleared += commission;
            if (row.status === "REVERSED") acc.reversed += commission;
            return acc;
        },
        { clicks: Number(clickCount?.value ?? 0), conversions: 0, pending: 0, cleared: 0, reversed: 0 }
    );

    const recent = await db.query.affiliate_attributions.findMany({
        where: eq(affiliate_attributions.affiliate_user_id, user.id),
        orderBy: [desc(affiliate_attributions.created_at)],
        limit: 50,
    });

    return {
        account: {
            code: account.code,
            status: account.status,
            reviewNotes: account.review_notes,
            reviewedAt: account.reviewed_at?.toISOString() ?? null,
            payoutMethod: account.payout_method,
            payoutAccount: decryptPdpField(account.payout_account),
            fullName: account.full_name,
            nik: decryptPdpField(account.nik),
            phone: account.phone,
            instagramHandle: account.instagram_handle,
            ktpUrl: account.ktp_url,
            ktpFileId: account.ktp_file_id,
            statementUrl: account.statement_url,
            statementFileId: account.statement_file_id,
            bankName: account.bank_name,
            bankAccountNumber: decryptPdpField(account.bank_account_number),
            bankAccountName: account.bank_account_name,
        },
        prefill,
        totals,
        attributions: recent.map((a) => ({
            id: a.id,
            orderId: a.order_id,
            commission: Number(a.computed_commission),
            rate: Number(a.rate_used),
            status: a.status,
            createdAt: a.created_at.toISOString(),
        })),
    };
}

export async function listAffiliatesForAdmin() {
    await requireAdmin();
    const rows = await db.query.affiliate_accounts.findMany({
        orderBy: [desc(affiliate_accounts.created_at)],
        with: {
            user: { columns: { id: true, name: true, email: true } },
        },
    });

    return rows.map((row) => ({
        ...row,
        payout_account: decryptPdpField(row.payout_account),
        bank_account_number: decryptPdpField(row.bank_account_number),
        // Decrypted for the admin reviewer (cross-check against the OCR result).
        nik: decryptPdpField(row.nik),
    }));
}

export async function approveAffiliateApplication(affiliateUserId: string) {
    try {
        return await approveAffiliateApplicationInternal(affiliateUserId);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyetujui affiliate.");
        logger.warn("affiliate:approve_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function approveAffiliateApplicationInternal(affiliateUserId: string) {
    const admin = await requireAdmin();

    const [updated] = await db
        .update(affiliate_accounts)
        .set({
            status: "ACTIVE",
            review_notes: null,
            reviewed_at: new Date(),
            reviewer_id: admin.id,
            updated_at: new Date(),
        })
        .where(and(eq(affiliate_accounts.user_id, affiliateUserId), eq(affiliate_accounts.status, "PENDING")))
        .returning({
            user_id: affiliate_accounts.user_id,
            code: affiliate_accounts.code,
            full_name: affiliate_accounts.full_name,
        });

    if (!updated) {
        throw new Error("Pengajuan affiliate tidak ditemukan atau sudah diproses.");
    }

    const affiliateUser = await db.query.users.findFirst({
        where: eq(users.id, affiliateUserId),
        columns: { id: true, email: true, name: true },
    });

    if (!affiliateUser) {
        throw new Error("User affiliate tidak ditemukan.");
    }

    await db.insert(notifications).values({
        user_id: affiliateUser.id,
        type: "SYSTEM",
        title: "Pengajuan Affiliate Disetujui",
        message: `Akun affiliate Anda telah disetujui. Kode referral aktif: ${updated.code}.`,
        idempotency_key: `AFFILIATE_APPROVED:${affiliateUser.id}`,
        data: { code: updated.code },
    }).onConflictDoNothing();

    await sendAffiliateApprovedEmail(
        affiliateUser.email,
        updated.full_name || affiliateUser.name,
        updated.code
    );

    revalidatePath("/affiliate");
    revalidatePath("/admin/affiliates");
    return { success: true as const };
}

export async function rejectAffiliateApplication(affiliateUserId: string, notes: string) {
    try {
        return await rejectAffiliateApplicationInternal(affiliateUserId, notes);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menolak affiliate.");
        logger.warn("affiliate:reject_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function rejectAffiliateApplicationInternal(affiliateUserId: string, notes: string) {
    const admin = await requireAdmin();

    const trimmedNotes = notes.trim();
    if (!trimmedNotes) {
        throw new Error("Alasan reject wajib diisi.");
    }

    const [updated] = await db
        .update(affiliate_accounts)
        .set({
            status: "REJECTED",
            review_notes: trimmedNotes,
            reviewed_at: new Date(),
            reviewer_id: admin.id,
            updated_at: new Date(),
        })
        .where(and(eq(affiliate_accounts.user_id, affiliateUserId), eq(affiliate_accounts.status, "PENDING")))
        .returning({
            user_id: affiliate_accounts.user_id,
            full_name: affiliate_accounts.full_name,
        });

    if (!updated) {
        throw new Error("Pengajuan affiliate tidak ditemukan atau sudah diproses.");
    }

    const affiliateUser = await db.query.users.findFirst({
        where: eq(users.id, affiliateUserId),
        columns: { id: true, email: true, name: true },
    });

    if (!affiliateUser) {
        throw new Error("User affiliate tidak ditemukan.");
    }

    await db.insert(notifications).values({
        user_id: affiliateUser.id,
        type: "SYSTEM",
        title: "Pengajuan Affiliate Perlu Revisi",
        message: `Pengajuan affiliate Anda perlu diperbaiki: ${trimmedNotes}`,
        idempotency_key: `AFFILIATE_REJECTED:${affiliateUser.id}:${Date.now()}`,
        data: { reason: trimmedNotes },
    });

    await sendAffiliateRejectedEmail(
        affiliateUser.email,
        updated.full_name || affiliateUser.name,
        trimmedNotes
    );

    revalidatePath("/affiliate");
    revalidatePath("/admin/affiliates");
    return { success: true as const };
}

const overrideRateSchema = z.object({
    affiliateUserId: z.string(),
    rate: z.number().min(0).max(100).nullable(),
});

export async function setAffiliateRateOverride(input: z.infer<typeof overrideRateSchema>) {
    try {
        return await setAffiliateRateOverrideInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal mengatur rate.");
        logger.warn("affiliate:rate_override_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function setAffiliateRateOverrideInternal(input: z.infer<typeof overrideRateSchema>) {
    await requireAdmin();
    const validated = overrideRateSchema.parse(input);
    await db
        .update(affiliate_accounts)
        .set({
            commission_rate_override: validated.rate === null ? null : String(validated.rate),
            updated_at: new Date(),
        })
        .where(eq(affiliate_accounts.user_id, validated.affiliateUserId));
    revalidatePath("/admin/affiliates");
    return { success: true as const };
}

export async function suspendAffiliate(affiliateUserId: string) {
    await requireAdmin();
    await db
        .update(affiliate_accounts)
        .set({ status: "SUSPENDED", updated_at: new Date() })
        .where(eq(affiliate_accounts.user_id, affiliateUserId));
    revalidatePath("/admin/affiliates");
    return { success: true as const };
}

export async function processAffiliatePayoutBatch() {
    try {
        return await processAffiliatePayoutBatchInternal();
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal memproses payout.");
        logger.warn("affiliate:payout_batch_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function processAffiliatePayoutBatchInternal() {
    await requireAdmin();

    const batchId = randomUUID();
    const stamp = new Date();

    // Idempotent claim: atomically stamp every still-unpaid CLEARED row with THIS
    // batch id and return only the rows we actually claimed. A concurrent/retried
    // run claims nothing (paid_at already set), so no commission is ever paid twice.
    const cleared = await db
        .update(affiliate_attributions)
        .set({ paid_at: stamp, payout_batch_id: batchId })
        .where(and(eq(affiliate_attributions.status, "CLEARED"), isNull(affiliate_attributions.paid_at)))
        .returning({
            id: affiliate_attributions.id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
            orderId: affiliate_attributions.order_id,
        });

    if (cleared.length === 0) {
        return { success: true as const, processed: 0, totalAmount: 0, lines: [] };
    }

    // Aggregate per affiliate for the batch payout summary.
    const totals = new Map<string, number>();
    for (const row of cleared) {
        totals.set(row.affiliateUserId, (totals.get(row.affiliateUserId) ?? 0) + Number(row.commission));
    }

    const lines = Array.from(totals.entries()).map(([affiliateUserId, amount]) => ({
        affiliateUserId,
        amount,
    }));

    // GL-12: post the cash-out leg per affiliate. Use a per-batch idempotency
    // suffix from the stamp so retries within the same batch are deduped.
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        for (const line of lines) {
            if (line.amount <= 0) continue;
            try {
                await postAffiliatePayment({
                    payoutId: `${batchId}:${line.affiliateUserId}`,
                    affiliateUserId: line.affiliateUserId,
                    grossCommission: line.amount,
                });
            } catch (glError) {
                logger.error("gl:post_affiliate_payment_failed", {
                    affiliateUserId: line.affiliateUserId,
                    error: String(glError),
                });
            }
        }
    }

    return {
        success: true as const,
        processed: cleared.length,
        totalAmount: lines.reduce((sum, l) => sum + l.amount, 0),
        lines,
    };
}
