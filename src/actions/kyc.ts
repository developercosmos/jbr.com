"use server";

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
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

// Default monthly GMV caps per KYC tier. Admin-configurable via the versioned
// accounting_settings store (keys below) without redeploying — these literals
// are only the fallback when no setting row exists.
const DEFAULT_TIER_CAPS: Record<"T0" | "T1" | "T2", number> = {
    T0: 10_000_000,
    T1: 50_000_000,
    T2: 250_000_000,
};

const TIER_CAP_SETTING_KEYS: Record<"T0" | "T1" | "T2", string> = {
    T0: "kyc.tier_cap_t0",
    T1: "kyc.tier_cap_t1",
    T2: "kyc.tier_cap_t2",
};

export async function getSellerTierCaps(): Promise<Record<"T0" | "T1" | "T2", number>> {
    const { getSetting } = await import("@/actions/accounting/settings");
    const [t0, t1, t2] = await Promise.all([
        getSetting<number>(TIER_CAP_SETTING_KEYS.T0, { defaultValue: DEFAULT_TIER_CAPS.T0 }),
        getSetting<number>(TIER_CAP_SETTING_KEYS.T1, { defaultValue: DEFAULT_TIER_CAPS.T1 }),
        getSetting<number>(TIER_CAP_SETTING_KEYS.T2, { defaultValue: DEFAULT_TIER_CAPS.T2 }),
    ]);
    return {
        T0: Number(t0 ?? DEFAULT_TIER_CAPS.T0) || DEFAULT_TIER_CAPS.T0,
        T1: Number(t1 ?? DEFAULT_TIER_CAPS.T1) || DEFAULT_TIER_CAPS.T1,
        T2: Number(t2 ?? DEFAULT_TIER_CAPS.T2) || DEFAULT_TIER_CAPS.T2,
    };
}

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

async function getSellerTierCap(tier: "T0" | "T1" | "T2") {
    const caps = await getSellerTierCaps();
    return caps[tier];
}

// Gating tambahan khusus T0 (configurable via accounting_settings):
// 1. Harga maksimal per produk yang boleh dipublikasikan.
// 2. Nilai maksimal sekali payout.
// Melewati salah satunya mewajibkan seller naik ke T1 (lengkapi KYC).
export async function getT0Gates(): Promise<{ maxProductPrice: number; maxPayout: number }> {
    const { getSetting } = await import("@/actions/accounting/settings");
    const [maxPrice, maxPayout] = await Promise.all([
        getSetting<number>("kyc.t0_max_product_price", { defaultValue: 1_000_000 }),
        getSetting<number>("kyc.t0_max_payout", { defaultValue: 10_000_000 }),
    ]);
    return {
        maxProductPrice: Number(maxPrice ?? 1_000_000) || 1_000_000,
        maxPayout: Number(maxPayout ?? 10_000_000) || 10_000_000,
    };
}

/**
 * Gate 1 — harga produk. No-op untuk T1/T2. Untuk T0, harga tertinggi di antara
 * harga dasar + semua varian tidak boleh melewati batas; melebihi = error yang
 * mengarahkan seller mengajukan KYC T1.
 */
export async function ensureSellerCanPriceProduct(sellerId: string, prices: Array<number | null | undefined>) {
    const seller = await db.query.users.findFirst({
        where: eq(users.id, sellerId),
        columns: { tier: true },
    });
    if (!seller || seller.tier !== "T0") return;

    const numeric = prices.filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);
    if (numeric.length === 0) return;
    const highest = Math.max(...numeric);

    const { maxProductPrice } = await getT0Gates();
    if (highest > maxProductPrice) {
        throw new Error(
            `Seller tier T0 hanya dapat memasang harga hingga Rp ${maxProductPrice.toLocaleString("id-ID")} per produk ` +
            `(harga Anda: Rp ${highest.toLocaleString("id-ID")}). Wajib naik ke tier T1 — lengkapi verifikasi KYC ` +
            `(KTP + selfie) di Pengaturan Toko → Verifikasi KYC Seller. Bonus: toko Anda mendapat lencana ` +
            `✓ Seller Terverifikasi yang tampil ke pembeli dan meningkatkan kepercayaan.`
        );
    }
}

/**
 * Enforcement akun COMPANY: wajib punya pengajuan KYC T2 (terkirim atau sudah
 * disetujui) sebelum boleh menerbitkan produk. No-op untuk akun PERSONAL.
 */
export async function ensureCompanyHasT2Application(userId: string) {
    const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { account_type: true, tier: true },
    });
    if (!user || user.account_type !== "COMPANY") return;
    if (user.tier === "T2") return;

    const kycRow = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, userId),
        columns: { tier: true, status: true },
    });
    const hasT2Application =
        kycRow?.tier === "T2" && (kycRow.status === "PENDING_REVIEW" || kycRow.status === "APPROVED");
    if (!hasT2Application) {
        throw new Error(
            "Akun perusahaan wajib melengkapi verifikasi T2 (KTP penanggung jawab + selfie + dokumen bisnis " +
            "NIB/SIUP) sebelum menerbitkan produk. Ajukan di Pengaturan Toko \u2192 Verifikasi KYC Seller dengan " +
            "memilih tier T2 \u2014 sekaligus mendapatkan lencana \u2713 Seller Terverifikasi."
        );
    }
}

export async function seedSellerKycProfile(userId: string) {
    // SECURITY: only the owner or an admin may seed a KYC profile row.
    const me = await getCurrentUser();
    if (me.id !== userId) await requireAdmin();
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
    // SECURITY: public Server Action ("use server" module) — authorize before read.
    // Only the owner or an admin; raw national-ID PII + reviewer identity are
    // admin-only; explicit file columns avoid leaking storage_key.
    const sessionUser = await getCurrentUser();
    let isAdmin = false;
    if (sessionUser.id !== userId) {
        await requireAdmin(); // throws if not admin
        isAdmin = true;
    } else {
        const me = await db.query.users.findFirst({
            where: eq(users.id, sessionUser.id),
            columns: { role: true },
        });
        isAdmin = me?.role === "ADMIN";
    }

    const profile = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, userId),
        with: {
            ktpFile: { columns: { id: true, original_name: true, mime_type: true } },
            selfieFile: { columns: { id: true, original_name: true, mime_type: true } },
            businessDocFile: { columns: { id: true, original_name: true, mime_type: true } },
            reviewer: { columns: { id: true, name: true, email: true } },
        },
    });

    if (!profile) return null;
    if (isAdmin) {
        return { ...profile, notes: decryptPdpField(profile.notes) };
    }
    // Non-admin (self): strip raw OCR/NIK PII + reviewer identity; keep own status
    // + rejection notes.
    const { nik: _nik, nik_hash: _nh, ocr: _ocr, screening: _scr, reviewer: _rv, ...safe } = profile;
    return { ...safe, notes: decryptPdpField(safe.notes) };
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
    const cap = await getSellerTierCap(seller.tier);

    if (nextTotal > cap) {
        throw new Error(
            `${seller.store_name || "Seller"} sudah mencapai batas transaksi bulanan tier ${seller.tier} ` +
            `(Rp ${cap.toLocaleString("id-ID")}). Seller dapat menaikkan batas dengan melengkapi verifikasi KYC ` +
            `sekaligus mendapatkan lencana ✓ Seller Terverifikasi yang meningkatkan kepercayaan pembeli.`
        );
    }

    return {
        tier: seller.tier,
        cap,
        currentMonthTotal,
        remaining: Math.max(cap - currentMonthTotal, 0),
    };
}

/**
 * Read-only monthly GMV status for display (never throws on over-cap). Used by
 * the seller settings cap meter and the registration info banner.
 */
export async function getSellerMonthlyGmvStatus(sellerId: string) {
    // SECURITY: public Server Action — only the seller themselves or an admin may
    // read another seller's GMV/tier.
    const u = await getCurrentUser();
    if (u.id !== sellerId) await requireAdmin();

    const seller = await db.query.users.findFirst({
        where: eq(users.id, sellerId),
        columns: { id: true, tier: true },
    });
    if (!seller) return null;

    const { start, end } = getMonthRange();
    const [result] = await db
        .select({ total: sql<string>`coalesce(sum(${orders.total}), '0')` })
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

    const used = Number(result?.total || 0);
    const cap = await getSellerTierCap(seller.tier);
    return {
        tier: seller.tier,
        cap,
        used,
        remaining: Math.max(cap - used, 0),
    };
}

export async function submitSellerKycApplication(input: z.infer<typeof submitSellerKycSchema>) {
    try {
        return await submitSellerKycApplicationInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal mengirim pengajuan KYC.");
        logger.warn("kyc:submit_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function submitSellerKycApplicationInternal(input: z.infer<typeof submitSellerKycSchema>) {
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
            account_type: true,
        },
    });

    if (!seller?.store_name || !seller.store_slug) {
        throw new Error("Aktifkan toko sebelum mengajukan KYC.");
    }

    // Jalur tier mengikuti tipe akun registrasi: T2 eksklusif akun Perusahaan,
    // akun pribadi hanya T1 (registrasi bisnis sudah dipisahkan).
    const isCompanyAccount = (seller.account_type ?? "PERSONAL") === "COMPANY";
    if (isCompanyAccount && validated.targetTier !== "T2") {
        throw new Error("Akun perusahaan hanya dapat mengajukan verifikasi T2.");
    }
    if (!isCompanyAccount && validated.targetTier !== "T1") {
        throw new Error(
            "Akun pribadi hanya dapat mengajukan verifikasi T1. Verifikasi T2 khusus akun Perusahaan \u2014 " +
            "daftarkan akun baru sebagai Perusahaan bila Anda berjualan atas nama bisnis (PT/CV)."
        );
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
    try {
        return await uploadKycDocumentInternal(formData);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal mengunggah dokumen.");
        logger.warn("kyc:upload_doc_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function uploadKycDocumentInternal(formData: FormData) {
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

    return { success: true as const, fileId: savedFile.id, slot };
}

export async function getCurrentSellerKyc() {
    const sessionUser = await getCurrentUser();
    return getSellerKycProfile(sessionUser.id);
}

const kycListFilterSchema = z
    .object({
        status: z.enum(["NOT_SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED"]).optional(),
        // Per-seller lookup (from Admin -> Users): shows that seller's submission
        // regardless of status, so approved documents stay reachable.
        sellerId: z.string().optional(),
    })
    .optional();

export async function listKycSubmissions(filter?: z.infer<typeof kycListFilterSchema>) {
    await requireAdmin();
    const validated = kycListFilterSchema.parse(filter);

    const submissions = await db.query.seller_kyc.findMany({
        where: validated?.sellerId
            ? eq(seller_kyc.user_id, validated.sellerId)
            : validated?.status
                ? eq(seller_kyc.status, validated.status)
                : undefined,
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
    try {
        return await reviewSellerKycApplicationInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal memproses review KYC.");
        logger.warn("kyc:review_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function reviewSellerKycApplicationInternal(input: z.infer<typeof reviewSellerKycSchema>) {
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

    return { success: true as const };
}
