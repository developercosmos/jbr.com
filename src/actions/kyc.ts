"use server";

import { db } from "@/db";
import { files, notifications, orders, seller_kyc, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq, gte, ilike, inArray, lt, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createHash } from "node:crypto";
import { uploadFile as uploadToStorage } from "@/lib/storage";
import { getFileTypeFromMime } from "@/lib/file-utils";
import { decryptPdpField, encryptPdpField } from "@/lib/crypto/pdp-field";
import { sendSellerKycApprovedEmail, sendSellerKycRejectedEmail } from "@/lib/email";
import { runKycScreening, validateNik } from "@/lib/kyc-screening";
import { decodeNikRegion } from "@/lib/wilayah";
import { isOcrConfigured, KYC_OCR_FEATURE_KEY } from "@/lib/kyc-ocr";
import { processKycOcrRow } from "@/lib/kyc-ocr-runner";
import { isFeatureEnabled } from "@/lib/feature-flags";

function sha256Hex(value: Buffer | string): string {
    return createHash("sha256").update(value).digest("hex");
}

const sellerTierCaps: Record<"T0" | "T1" | "T2", number> = {
    T0: 10_000_000,
    T1: 50_000_000,
    T2: 250_000_000,
};

const submitSellerKycSchema = z.object({
    targetTier: z.enum(["T1", "T2"]),
    ktpFileId: z.string().uuid(),
    selfieFileId: z.string().uuid(),
    businessDocFileId: z.string().uuid().optional(),
    nik: z
        .string()
        .trim()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => v.length === 16, "NIK harus 16 digit angka."),
    notes: z.string().max(500).optional(),
});

const reviewSellerKycSchema = z.object({
    sellerId: z.string(),
    decision: z.enum(["APPROVED", "REJECTED"]),
    approvedTier: z.enum(["T1", "T2"]).optional(),
    notes: z.string().max(500).optional(),
});

async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    return session.user;
}

async function requireAdmin() {
    const sessionUser = await getCurrentUser();
    const admin = await db.query.users.findFirst({
        where: eq(users.id, sessionUser.id),
        columns: {
            id: true,
            role: true,
        },
    });

    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Admin access required");
    }

    return admin;
}

function getMonthRange(referenceDate = new Date()) {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
    return { start, end };
}

function getSellerTierCap(tier: "T0" | "T1" | "T2") {
    return sellerTierCaps[tier];
}

export async function seedSellerKycProfile(userId: string) {
    const existing = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, userId),
        columns: { id: true },
    });

    if (existing) {
        return existing;
    }

    const [created] = await db
        .insert(seller_kyc)
        .values({
            user_id: userId,
            tier: "T0",
            status: "APPROVED",
            submitted_at: new Date(),
            reviewed_at: new Date(),
            notes: encryptPdpField("Auto-approved T0 after seller activation."),
        })
        .returning({
            id: seller_kyc.id,
        });

    await db
        .update(users)
        .set({ tier: "T0", updated_at: new Date() })
        .where(eq(users.id, userId));

    return created;
}

export async function getSellerKycProfile(userId: string) {
    const profile = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, userId),
        with: {
            ktpFile: true,
            selfieFile: true,
            businessDocFile: true,
            reviewer: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
    });

    if (!profile) return null;
    return {
        ...profile,
        notes: decryptPdpField(profile.notes),
    };
}

export async function ensureSellerWithinMonthlyGmvCap(sellerId: string, pendingOrderTotal: number) {
    const seller = await db.query.users.findFirst({
        where: eq(users.id, sellerId),
        columns: {
            id: true,
            tier: true,
            store_name: true,
        },
    });

    if (!seller) {
        throw new Error("Seller tidak ditemukan");
    }

    const { start, end } = getMonthRange();
    const [result] = await db
        .select({
            total: sql<string>`coalesce(sum(${orders.total}), '0')`,
        })
        .from(orders)
        .where(
            and(
                eq(orders.seller_id, sellerId),
                gte(orders.created_at, start),
                lt(orders.created_at, end),
                ne(orders.status, "CANCELLED"),
                ne(orders.status, "REFUNDED")
            )
        );

    const currentMonthTotal = Number(result?.total || 0);
    const nextTotal = currentMonthTotal + pendingOrderTotal;
    const cap = getSellerTierCap(seller.tier);

    if (nextTotal > cap) {
        throw new Error(
            `${seller.store_name || "Seller"} sudah mencapai batas transaksi bulanan tier ${seller.tier}.`
        );
    }

    return {
        tier: seller.tier,
        cap,
        currentMonthTotal,
        remaining: Math.max(cap - currentMonthTotal, 0),
    };
}

export async function submitSellerKycApplication(input: z.infer<typeof submitSellerKycSchema>) {
    const sessionUser = await getCurrentUser();
    const validated = submitSellerKycSchema.parse(input);

    if (validated.targetTier === "T2" && !validated.businessDocFileId) {
        throw new Error("Dokumen bisnis wajib untuk pengajuan tier T2.");
    }

    const seller = await db.query.users.findFirst({
        where: eq(users.id, sessionUser.id),
        columns: {
            id: true,
            store_name: true,
            store_slug: true,
        },
    });

    if (!seller?.store_name || !seller.store_slug) {
        throw new Error("Aktifkan toko sebelum mengajukan KYC.");
    }

    const fileIds = [validated.ktpFileId, validated.selfieFileId, validated.businessDocFileId].filter(Boolean) as string[];
    const uploadedFiles = fileIds.length
        ? await db.query.files.findMany({
            where: inArray(files.id, fileIds),
            columns: {
                id: true,
                uploaded_by: true,
                is_public: true,
                mime_type: true,
                size: true,
                content_hash: true,
            },
        })
        : [];

    if (uploadedFiles.length !== fileIds.length || uploadedFiles.some((file) => file.uploaded_by !== sessionUser.id || file.is_public)) {
        throw new Error("Dokumen KYC harus berupa file privat milik akun Anda sendiri.");
    }

    const ktpFile = uploadedFiles.find((f) => f.id === validated.ktpFileId)!;
    const selfieFile = uploadedFiles.find((f) => f.id === validated.selfieFileId)!;

    // ---- Preliminary auto-screening (in-house, no external API) ----
    const nikHash = sha256Hex(validated.nik);
    const nikValidation = validateNik(validated.nik);
    // Resolve the region encoded in the NIK against the baked-in wilayah dataset
    // (null = code not found -> flagged by the screener, not auto-rejected).
    const region = decodeNikRegion(validated.nik);

    // Byte-identical KTP/selfie reused by another account → fraud signal.
    const docHashes = [ktpFile.content_hash, selfieFile.content_hash].filter(Boolean) as string[];
    let duplicateDocAccountCount = 0;
    if (docHashes.length) {
        const dupDocs = await db.query.files.findMany({
            where: and(inArray(files.content_hash, docHashes), ne(files.uploaded_by, sessionUser.id), ilike(files.folder, "kyc/%")),
            columns: { uploaded_by: true },
        });
        duplicateDocAccountCount = new Set(dupDocs.map((d) => d.uploaded_by)).size;
    }

    // Same NIK already submitted by another account.
    const dupNik = await db.query.seller_kyc.findMany({
        where: and(eq(seller_kyc.nik_hash, nikHash), ne(seller_kyc.user_id, sessionUser.id)),
        columns: { user_id: true },
    });

    const screening = runKycScreening({
        nikValidation: { valid: nikValidation.valid, reason: nikValidation.reason },
        ktp: { mime: ktpFile.mime_type, size: ktpFile.size, contentHash: ktpFile.content_hash },
        selfie: { mime: selfieFile.mime_type, size: selfieFile.size, contentHash: selfieFile.content_hash },
        duplicateDocAccountCount,
        duplicateNikAccountCount: dupNik.length,
        region,
    });

    const autoRejected = screening.autoReject;
    const finalStatus = autoRejected ? ("REJECTED" as const) : ("PENDING_REVIEW" as const);
    const autoNote = autoRejected
        ? `Ditolak otomatis oleh pra-screening: ${screening.flags.filter((f) => f.severity === "high").map((f) => f.message).join(" ")}`
        : validated.notes;
    const now = new Date();

    // Queue async OCR only for submissions that will actually be reviewed, and
    // only when the feature is on AND an endpoint is configured. The background
    // sweep (/api/cron/kyc-ocr) picks up rows with ocr_status = "PENDING".
    const ocrShouldQueue = !autoRejected && isOcrConfigured() && (await isFeatureEnabled(KYC_OCR_FEATURE_KEY));

    const kycValues = {
        tier: validated.targetTier,
        status: finalStatus,
        ktp_file_id: validated.ktpFileId,
        selfie_file_id: validated.selfieFileId,
        business_doc_file_id: validated.businessDocFileId,
        nik: encryptPdpField(validated.nik),
        nik_hash: nikHash,
        screening,
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
        submitted_at: now,
        reviewed_at: autoRejected ? now : null,
        reviewer_id: null,
        notes: encryptPdpField(autoNote),
        updated_at: now,
    };

    await db
        .insert(seller_kyc)
        .values({ user_id: sessionUser.id, ...kycValues })
        .onConflictDoUpdate({ target: seller_kyc.user_id, set: kycValues });

    // Instant OCR kick: run in the background AFTER the response is sent, so the
    // seller never waits on the ~30s LLM call and the result is usually ready by
    // the time an admin opens the review. If this kick dies mid-flight the row
    // stays PENDING and the cron sweep (/api/cron/kyc-ocr) retries it.
    if (ocrShouldQueue) {
        const kycRow = await db.query.seller_kyc.findFirst({
            where: eq(seller_kyc.user_id, sessionUser.id),
        });
        if (kycRow) {
            after(async () => {
                try {
                    await processKycOcrRow(kycRow);
                } catch (e) {
                    console.error("[submitKyc] OCR kick failed (cron sweep will retry):", e);
                }
            });
        }
    }

    // Auto-rejected: tell the seller why and skip the admin queue (nothing to review).
    if (autoRejected) {
        try {
            await db.insert(notifications).values({
                user_id: sessionUser.id,
                type: "SYSTEM",
                title: "Pengajuan KYC Ditolak Otomatis",
                message: autoNote || "Pengajuan KYC ditolak oleh sistem. Perbaiki dokumen lalu ajukan ulang.",
                data: { tier: validated.targetTier, auto: true },
            });
        } catch (e) {
            console.error("[submitKyc] failed to notify seller of auto-reject:", e);
        }
        const sellerUser = await db.query.users.findFirst({
            where: eq(users.id, sessionUser.id),
            columns: { email: true, name: true },
        });
        if (sellerUser?.email) {
            sendSellerKycRejectedEmail(
                sellerUser.email,
                sellerUser.name || seller.store_name || "Penjual",
                autoNote || "Dokumen KYC tidak valid."
            ).catch((e) => console.error("[submitKyc] auto-reject email failed:", e));
        }
        revalidatePath("/seller/settings");
        return { success: true as const, autoRejected: true as const, screening };
    }

    const admins = await db.query.users.findMany({
        where: eq(users.role, "ADMIN"),
        columns: { id: true },
    });

    // Reviewer notification is a best-effort nudge — it must NEVER block the KYC
    // submission. On a re-submission after rejection the idempotency_key already
    // exists (same seller+tier+reviewer), so onConflictDoNothing turns the
    // duplicate into a no-op instead of throwing; the re-submission still shows
    // up in the reviewer's PENDING queue (driven by seller_kyc.status). try/catch
    // guards any other transient failure.
    for (const admin of admins) {
        try {
            await db
                .insert(notifications)
                .values({
                    user_id: admin.id,
                    type: "SELLER_REVIEW_NEEDED",
                    title: "Review KYC Seller Dibutuhkan",
                    message: `${seller.store_name} mengajukan upgrade KYC ke ${validated.targetTier}.`,
                    idempotency_key: `SELLER_KYC_REVIEW:${sessionUser.id}:${validated.targetTier}:${admin.id}`,
                    data: {
                        seller_id: sessionUser.id,
                        tier: validated.targetTier,
                    },
                })
                .onConflictDoNothing();
        } catch (e) {
            console.error(`[submitKyc] failed to notify admin ${admin.id}:`, e);
        }
    }

    revalidatePath("/seller/settings");
    revalidatePath("/admin/users");

    return { success: true as const, autoRejected: false as const, screening };
}

const SLOT_ALLOWED_KYC_MIME: Record<"ktp" | "selfie" | "business" | "statement", Set<string>> = {
    ktp: new Set(["image/jpeg", "image/png", "image/webp"]),
    selfie: new Set(["image/jpeg", "image/png", "image/webp"]),
    business: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    // Surat Pernyataan affiliate (private, same pipeline as the KYC docs).
    statement: new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
};

const MIME_EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
};

function buildSafeKycFilename(slot: "ktp" | "selfie" | "business" | "statement", mimeType: string): string {
    const extension = MIME_EXTENSION[mimeType] ?? "bin";
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${slot}-${token}.${extension}`;
}

export async function uploadKycDocument(formData: FormData) {
    const sessionUser = await getCurrentUser();

    const file = formData.get("file") as File | null;
    const slot = formData.get("slot") as string | null;

    if (!file) {
        throw new Error("Berkas wajib diunggah.");
    }

    if (!slot || !["ktp", "selfie", "business", "statement"].includes(slot)) {
        throw new Error("Slot dokumen tidak valid.");
    }

    const typedSlot = slot as "ktp" | "selfie" | "business" | "statement";
    const allowedMime = SLOT_ALLOWED_KYC_MIME[typedSlot];

    if (!allowedMime.has(file.type)) {
        if (typedSlot === "business" || typedSlot === "statement") {
            throw new Error("Format dokumen harus JPG, PNG, WEBP, atau PDF.");
        }
        throw new Error("Format KTP/selfie harus berupa gambar JPG, PNG, atau WEBP (PDF tidak diperbolehkan).");
    }

    if (file.size <= 0) {
        throw new Error("Berkas kosong tidak dapat diunggah.");
    }

    if (file.size > 8 * 1024 * 1024) {
        throw new Error("Ukuran dokumen maksimal 8 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = `kyc/${sessionUser.id}/${slot}`;
    const safeName = buildSafeKycFilename(typedSlot, file.type);
    // KYC documents are private — never public-read on S3 (served via /api/files/[id]).
    const stored = await uploadToStorage(folder, safeName, buffer, file.type, sessionUser.id, false);

    const [savedFile] = await db
        .insert(files)
        .values({
            filename: stored.key.split("/").pop() || safeName,
            original_name: `${typedSlot}.${MIME_EXTENSION[file.type] ?? "file"}`,
            mime_type: file.type,
            file_type: getFileTypeFromMime(file.type),
            size: file.size,
            storage_type: stored.storageType,
            storage_key: stored.key,
            folder,
            content_hash: sha256Hex(buffer),
            is_public: false,
            uploaded_by: sessionUser.id,
        })
        .returning({ id: files.id });

    return { fileId: savedFile.id, slot };
}

export async function getCurrentSellerKyc() {
    const sessionUser = await getCurrentUser();
    return getSellerKycProfile(sessionUser.id);
}

const kycListFilterSchema = z
    .object({
        status: z.enum(["NOT_SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
    })
    .optional();

export async function listKycSubmissions(filter?: z.infer<typeof kycListFilterSchema>) {
    await requireAdmin();
    const validated = kycListFilterSchema.parse(filter);

    const submissions = await db.query.seller_kyc.findMany({
        where: validated?.status ? eq(seller_kyc.status, validated.status) : undefined,
        orderBy: [desc(seller_kyc.submitted_at), desc(seller_kyc.updated_at)],
        with: {
            seller: {
                columns: {
                    id: true,
                    name: true,
                    email: true,
                    store_name: true,
                    store_slug: true,
                    tier: true,
                },
            },
            ktpFile: { columns: { id: true, original_name: true, mime_type: true } },
            selfieFile: { columns: { id: true, original_name: true, mime_type: true } },
            businessDocFile: { columns: { id: true, original_name: true, mime_type: true } },
            reviewer: { columns: { id: true, name: true, email: true } },
        },
    });

    return submissions.map((submission) => {
        // Never ship the raw encrypted NIK or the dup-detection hash to the client;
        // decrypt the NIK for the admin reviewer and drop the hash.
        const { nik_hash: _nikHash, nik, ...rest } = submission;
        return {
            ...rest,
            notes: decryptPdpField(submission.notes),
            nik: nik ? decryptPdpField(nik) : null,
        };
    });
}

export async function getKycSubmissionCounts() {
    await requireAdmin();

    const rows = await db
        .select({ status: seller_kyc.status, count: sql<number>`count(*)` })
        .from(seller_kyc)
        .groupBy(seller_kyc.status);

    const counts: Record<string, number> = { NOT_SUBMITTED: 0, PENDING_REVIEW: 0, APPROVED: 0, REJECTED: 0 };
    for (const row of rows) {
        counts[row.status] = Number(row.count);
    }
    return counts;
}

export async function reviewSellerKycApplication(input: z.infer<typeof reviewSellerKycSchema>) {
    const admin = await requireAdmin();
    const validated = reviewSellerKycSchema.parse(input);
    const trimmedNotes = validated.notes?.trim();

    if (validated.decision === "REJECTED" && !trimmedNotes) {
        throw new Error("Catatan penolakan wajib diisi.");
    }

    const kycProfile = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, validated.sellerId),
        columns: {
            id: true,
            tier: true,
        },
    });

    const seller = await db.query.users.findFirst({
        where: eq(users.id, validated.sellerId),
        columns: {
            id: true,
            name: true,
            email: true,
            store_name: true,
        },
    });

    if (!kycProfile || !seller) {
        throw new Error("Pengajuan KYC seller tidak ditemukan.");
    }

    const approvedTier = validated.approvedTier || kycProfile.tier;

    await db
        .update(seller_kyc)
        .set({
            tier: validated.decision === "APPROVED" ? approvedTier : kycProfile.tier,
            status: validated.decision,
            reviewed_at: new Date(),
            reviewer_id: admin.id,
            notes: trimmedNotes ? encryptPdpField(trimmedNotes) : null,
            updated_at: new Date(),
        })
        .where(eq(seller_kyc.user_id, validated.sellerId));

    if (validated.decision === "APPROVED") {
        await db
            .update(users)
            .set({
                tier: approvedTier,
                updated_at: new Date(),
            })
            .where(eq(users.id, validated.sellerId));
    }

    await db.insert(notifications).values({
        user_id: seller.id,
        type: "SYSTEM",
        title: validated.decision === "APPROVED" ? "KYC Seller Disetujui" : "KYC Seller Perlu Revisi",
        message: validated.decision === "APPROVED"
            ? `Pengajuan KYC Anda telah disetujui ke tier ${approvedTier}.`
            : `Pengajuan KYC Anda perlu diperbaiki: ${trimmedNotes}`,
        idempotency_key: `SELLER_KYC_${validated.decision}:${seller.id}:${Date.now()}`,
        data: {
            tier: approvedTier,
            reason: trimmedNotes ?? null,
        },
    });

    if (validated.decision === "APPROVED") {
        await sendSellerKycApprovedEmail(
            seller.email,
            seller.store_name || seller.name,
            approvedTier
        );
    } else if (trimmedNotes) {
        await sendSellerKycRejectedEmail(
            seller.email,
            seller.store_name || seller.name,
            trimmedNotes
        );
    }

    revalidatePath("/admin/users");
    revalidatePath("/seller/settings");
    revalidatePath(`/store/${validated.sellerId}`);

    return { success: true };
}
