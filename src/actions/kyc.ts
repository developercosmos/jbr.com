"use server";

import { db } from "@/db";
import { files, notifications, orders, seller_kyc, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq, gte, lt, ne, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadFile as uploadToStorage } from "@/lib/storage";
import { getFileTypeFromMime } from "@/lib/file-utils";

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

export function getSellerTierCap(tier: "T0" | "T1" | "T2") {
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
            notes: "Auto-approved T0 after seller activation.",
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
    return db.query.seller_kyc.findFirst({
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
            where: sql`${files.id} = ANY(${fileIds})`,
            columns: {
                id: true,
                uploaded_by: true,
                is_public: true,
            },
        })
        : [];

    if (uploadedFiles.length !== fileIds.length || uploadedFiles.some((file) => file.uploaded_by !== sessionUser.id || file.is_public)) {
        throw new Error("Dokumen KYC harus berupa file privat milik akun Anda sendiri.");
    }

    await db
        .insert(seller_kyc)
        .values({
            user_id: sessionUser.id,
            tier: validated.targetTier,
            status: "PENDING_REVIEW",
            ktp_file_id: validated.ktpFileId,
            selfie_file_id: validated.selfieFileId,
            business_doc_file_id: validated.businessDocFileId,
            submitted_at: new Date(),
            reviewed_at: null,
            reviewer_id: null,
            notes: validated.notes,
            updated_at: new Date(),
        })
        .onConflictDoUpdate({
            target: seller_kyc.user_id,
            set: {
                tier: validated.targetTier,
                status: "PENDING_REVIEW",
                ktp_file_id: validated.ktpFileId,
                selfie_file_id: validated.selfieFileId,
                business_doc_file_id: validated.businessDocFileId,
                submitted_at: new Date(),
                reviewed_at: null,
                reviewer_id: null,
                notes: validated.notes,
                updated_at: new Date(),
            },
        });

    const admins = await db.query.users.findMany({
        where: eq(users.role, "ADMIN"),
        columns: { id: true },
    });

    for (const admin of admins) {
        await db.insert(notifications).values({
            user_id: admin.id,
            type: "SELLER_REVIEW_NEEDED",
            title: "Review KYC Seller Dibutuhkan",
            message: `${seller.store_name} mengajukan upgrade KYC ke ${validated.targetTier}.`,
            idempotency_key: `SELLER_KYC_REVIEW:${sessionUser.id}:${validated.targetTier}:${admin.id}`,
            data: {
                seller_id: sessionUser.id,
                tier: validated.targetTier,
            },
        });
    }

    revalidatePath("/seller/settings");
    revalidatePath("/admin/users");

    return { success: true };
}

const ALLOWED_KYC_MIME = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
]);

export async function uploadKycDocument(formData: FormData) {
    const sessionUser = await getCurrentUser();

    const file = formData.get("file") as File | null;
    const slot = formData.get("slot") as string | null;

    if (!file) {
        throw new Error("Berkas wajib diunggah.");
    }

    if (!slot || !["ktp", "selfie", "business"].includes(slot)) {
        throw new Error("Slot dokumen tidak valid.");
    }

    if (!ALLOWED_KYC_MIME.has(file.type)) {
        throw new Error("Format dokumen harus JPG, PNG, WEBP, atau PDF.");
    }

    if (file.size > 8 * 1024 * 1024) {
        throw new Error("Ukuran dokumen maksimal 8 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = `kyc/${sessionUser.id}/${slot}`;
    const stored = await uploadToStorage(folder, file.name, buffer, file.type, sessionUser.id);

    const [savedFile] = await db
        .insert(files)
        .values({
            filename: stored.key.split("/").pop() || file.name,
            original_name: file.name,
            mime_type: file.type,
            file_type: getFileTypeFromMime(file.type),
            size: file.size,
            storage_type: stored.storageType,
            storage_key: stored.key,
            folder,
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

    return submissions;
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

    const kycProfile = await db.query.seller_kyc.findFirst({
        where: eq(seller_kyc.user_id, validated.sellerId),
        columns: {
            id: true,
            tier: true,
        },
    });

    if (!kycProfile) {
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
            notes: validated.notes,
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

    revalidatePath("/admin/users");
    revalidatePath("/seller/settings");
    revalidatePath(`/store/${validated.sellerId}`);

    return { success: true };
}
