"use server";

import { db } from "@/db";
import { addresses, notifications, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessSellerCenter, normalizeStoreSlug } from "@/lib/seller";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { uploadFile as uploadToStorage } from "@/lib/storage";

const reservedStoreSlugs = new Set([
    "admin",
    "affiliate",
    "api",
    "auth",
    "cart",
    "category",
    "checkout",
    "compare",
    "help",
    "messages",
    "product",
    "profile",
    "search",
    "seller",
    "store",
]);

const storeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const activateSellerProfileSchema = z.object({
    storeName: z.string().min(3).max(80),
    storeSlug: z.string().min(3).max(80).regex(storeSlugPattern, "Slug toko tidak valid"),
    pickupAddressId: z.string().uuid(),
    payoutBankName: z.string().min(2).max(80),
    storeDescription: z.string().max(300).optional(),
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

export async function getSellerProfileByUserId(userId: string) {
    return db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: {
            id: true,
            name: true,
            email: true,
            image: true,
            store_name: true,
            store_slug: true,
            store_description: true,
            store_tagline: true,
            store_banner_url: true,
            store_status: true,
            payout_bank_name: true,
            tier: true,
        },
    });
}

export async function checkStoreSlugAvailability(storeSlug: string) {
    const normalized = normalizeStoreSlug(storeSlug);

    if (normalized.length < 3) {
        return { available: false, normalized, reason: "Slug toko terlalu pendek" };
    }

    if (reservedStoreSlugs.has(normalized)) {
        return { available: false, normalized, reason: "Slug toko sudah dicadangkan" };
    }

    const existing = await db.query.users.findFirst({
        where: eq(users.store_slug, normalized),
        columns: { id: true },
    });

    return {
        available: !existing,
        normalized,
        reason: existing ? "Slug toko sudah dipakai" : null,
    };
}

export async function activateSellerProfile(input: z.infer<typeof activateSellerProfileSchema>) {
    const sessionUser = await getCurrentUser();
    const parsed = activateSellerProfileSchema.safeParse({
        ...input,
        storeSlug: normalizeStoreSlug(input.storeSlug),
    });

    if (!parsed.success) {
        // Return validation failures instead of throwing so the user sees a
        // friendly message — Next.js strips Server Action error messages in
        // production builds, which would otherwise surface as the generic
        // "An error occurred in the Server Components render" string.
        const first = parsed.error.issues[0];
        const fieldLabel: Record<string, string> = {
            storeName: "Nama Toko",
            storeSlug: "Slug Toko",
            pickupAddressId: "Alamat Pickup",
            payoutBankName: "Bank Payout",
            storeDescription: "Deskripsi Toko",
        };
        const field = String(first?.path[0] ?? "");
        const label = fieldLabel[field] ?? field;
        return {
            success: false as const,
            error: label
                ? `${label}: ${first?.message ?? "tidak valid"}`
                : (first?.message ?? "Data tidak valid"),
            fieldErrors: Object.fromEntries(
                parsed.error.issues.map((i) => [String(i.path[0] ?? ""), i.message])
            ),
        };
    }

    const validated = parsed.data;

    const user = await db.query.users.findFirst({
        where: eq(users.id, sessionUser.id),
    });

    if (!user) {
        return { success: false as const, error: "User tidak ditemukan" };
    }

    if (user.store_status === "BANNED") {
        return { success: false as const, error: "Akun seller Anda dibatasi. Hubungi admin untuk bantuan." };
    }

    const slugAvailability = await checkStoreSlugAvailability(validated.storeSlug);
    if (!slugAvailability.available && user.store_slug !== validated.storeSlug) {
        return { success: false as const, error: slugAvailability.reason || "Slug toko tidak tersedia" };
    }

    const pickupAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, validated.pickupAddressId),
            eq(addresses.user_id, sessionUser.id)
        ),
    });

    if (!pickupAddress) {
        return { success: false as const, error: "Alamat pickup tidak valid" };
    }

    // Combine the two pickup-address updates into a single CASE statement so
    // we issue one round-trip instead of two.
    await db
        .update(addresses)
        .set({
            is_default_pickup: sql`CASE WHEN ${addresses.id} = ${validated.pickupAddressId} THEN true ELSE false END`,
        })
        .where(eq(addresses.user_id, sessionUser.id));

    const [updatedUser] = await db
        .update(users)
        .set({
            store_name: validated.storeName,
            store_slug: validated.storeSlug,
            store_description: validated.storeDescription,
            payout_bank_name: validated.payoutBankName,
            store_status: "PENDING_REVIEW",
            updated_at: new Date(),
        })
        .where(eq(users.id, sessionUser.id))
        .returning();

    // Fan out notification inserts in parallel — the seller's own activation
    // notification and the admin review notifications are independent.
    const admins = await db.query.users.findMany({
        where: eq(users.role, "ADMIN"),
        columns: { id: true },
    });

    const notificationInserts: Promise<unknown>[] = [
        db.insert(notifications).values({
            user_id: sessionUser.id,
            type: "SELLER_ACTIVATED",
            title: "Akun Seller Aktif",
            message: `Toko ${validated.storeName} berhasil dibuat dan siap mulai berjualan.`,
            idempotency_key: `SELLER_ACTIVATED:${sessionUser.id}`,
            data: {
                store_slug: validated.storeSlug,
                store_status: updatedUser.store_status,
            },
        }),
    ];

    if (updatedUser.store_status === "PENDING_REVIEW") {
        for (const admin of admins) {
            notificationInserts.push(
                db.insert(notifications).values({
                    user_id: admin.id,
                    type: "SELLER_REVIEW_NEEDED",
                    title: "Seller Baru Perlu Review",
                    message: `${validated.storeName} baru saja mengaktifkan toko dan menunggu review admin.`,
                    idempotency_key: `SELLER_REVIEW_NEEDED:${sessionUser.id}:${admin.id}`,
                    data: {
                        seller_id: sessionUser.id,
                        store_slug: validated.storeSlug,
                    },
                })
            );
        }
    }

    await Promise.all(notificationInserts);

    revalidatePath("/seller");
    revalidatePath("/seller/register");
    revalidatePath("/admin/users");
    revalidatePath("/admin/moderation");
    revalidatePath(`/store/${validated.storeSlug}`);

    return {
        success: true as const,
        // Land directly on the KYC section after activation so the seller can
        // immediately upgrade from T0 to T1/T2 instead of having to discover
        // the option in /seller/settings on their own.
        redirectTo: "/seller/settings?welcome=1#kyc",
        storeStatus: updatedUser.store_status,
    };
}

export async function ensureCurrentUserCanSell() {
    const sessionUser = await getCurrentUser();
    const user = await getSellerProfileByUserId(sessionUser.id);

    if (!user || !user.store_name || !user.store_slug || !canAccessSellerCenter(user.store_status)) {
        throw new Error("Seller profile belum aktif");
    }

    return user;
}

// ============================================
// UPDATE SELLER PROFILE (text fields + pickup address)
// ============================================
const updateSellerProfileSchema = z.object({
    storeName: z.string().min(3, "Nama toko minimal 3 karakter").max(80),
    storeTagline: z.string().max(120).optional().nullable(),
    storeDescription: z.string().max(600).optional().nullable(),
    payoutBankName: z.string().min(2, "Bank payout minimal 2 karakter").max(80),
    pickupAddressId: z.string().uuid().optional().nullable(),
});

export type UpdateSellerProfileInput = z.infer<typeof updateSellerProfileSchema>;

export async function updateSellerProfile(input: UpdateSellerProfileInput) {
    const sessionUser = await getCurrentUser();

    const parsed = updateSellerProfileSchema.safeParse(input);
    if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
            const key = issue.path[0]?.toString() ?? "form";
            fieldErrors[key] = issue.message;
        }
        return {
            success: false as const,
            error: parsed.error.issues[0]?.message ?? "Data tidak valid",
            fieldErrors,
        };
    }

    const data = parsed.data;

    // Verify pickup address belongs to user (if provided)
    if (data.pickupAddressId) {
        const owned = await db.query.addresses.findFirst({
            where: and(
                eq(addresses.id, data.pickupAddressId),
                eq(addresses.user_id, sessionUser.id),
            ),
            columns: { id: true },
        });
        if (!owned) {
            return {
                success: false as const,
                error: "Alamat pickup tidak ditemukan",
                fieldErrors: { pickupAddressId: "Alamat tidak valid" },
            };
        }
        // Set this address as default pickup, others false
        await db
            .update(addresses)
            .set({
                is_default_pickup: sql`CASE WHEN ${addresses.id} = ${data.pickupAddressId} THEN true ELSE false END`,
            })
            .where(eq(addresses.user_id, sessionUser.id));
    }

    await db
        .update(users)
        .set({
            store_name: data.storeName,
            store_tagline: data.storeTagline ?? null,
            store_description: data.storeDescription ?? null,
            payout_bank_name: data.payoutBankName,
            updated_at: new Date(),
        })
        .where(eq(users.id, sessionUser.id));

    revalidatePath("/seller/settings");
    revalidatePath("/seller");

    return { success: true as const };
}

// ============================================
// UPLOAD SELLER BANNER / LOGO
// ============================================
const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

async function uploadSellerImage(formData: FormData, kind: "banner" | "logo") {
    const sessionUser = await getCurrentUser();
    const file = formData.get("file") as File | null;

    if (!file) {
        return { success: false as const, error: "File tidak ditemukan" };
    }
    if (!ALLOWED_IMAGE_MIME.includes(file.type)) {
        return {
            success: false as const,
            error: "Format tidak didukung. Gunakan JPG/PNG/WEBP",
        };
    }
    if (file.size > MAX_IMAGE_BYTES) {
        return { success: false as const, error: "Ukuran maksimum 5MB" };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const folder = kind === "banner" ? "store-banners" : "store-logos";
    const result = await uploadToStorage(folder, file.name, buffer, file.type, sessionUser.id);

    if (kind === "banner") {
        await db
            .update(users)
            .set({ store_banner_url: result.url, updated_at: new Date() })
            .where(eq(users.id, sessionUser.id));
    } else {
        await db
            .update(users)
            .set({ image: result.url, updated_at: new Date() })
            .where(eq(users.id, sessionUser.id));
    }

    revalidatePath("/seller/settings");
    revalidatePath("/seller");

    return { success: true as const, url: result.url };
}

export async function uploadSellerBanner(formData: FormData) {
    return uploadSellerImage(formData, "banner");
}

export async function uploadSellerLogo(formData: FormData) {
    return uploadSellerImage(formData, "logo");
}
