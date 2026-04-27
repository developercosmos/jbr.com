"use server";

import { db } from "@/db";
import { addresses, notifications, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessSellerCenter, normalizeStoreSlug } from "@/lib/seller";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
            store_name: true,
            store_slug: true,
            store_description: true,
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
    const validated = activateSellerProfileSchema.parse({
        ...input,
        storeSlug: normalizeStoreSlug(input.storeSlug),
    });

    const user = await db.query.users.findFirst({
        where: eq(users.id, sessionUser.id),
    });

    if (!user) {
        throw new Error("User tidak ditemukan");
    }

    if (user.store_status === "BANNED") {
        throw new Error("Akun seller Anda dibatasi. Hubungi admin untuk bantuan.");
    }

    const slugAvailability = await checkStoreSlugAvailability(validated.storeSlug);
    if (!slugAvailability.available && user.store_slug !== validated.storeSlug) {
        throw new Error(slugAvailability.reason || "Slug toko tidak tersedia");
    }

    const pickupAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, validated.pickupAddressId),
            eq(addresses.user_id, sessionUser.id)
        ),
    });

    if (!pickupAddress) {
        throw new Error("Alamat pickup tidak valid");
    }

    await db
        .update(addresses)
        .set({ is_default_pickup: false })
        .where(eq(addresses.user_id, sessionUser.id));

    await db
        .update(addresses)
        .set({ is_default_pickup: true })
        .where(eq(addresses.id, validated.pickupAddressId));

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

    await db.insert(notifications).values({
        user_id: sessionUser.id,
        type: "SELLER_ACTIVATED",
        title: "Akun Seller Aktif",
        message: `Toko ${validated.storeName} berhasil dibuat dan siap mulai berjualan.`,
        idempotency_key: `SELLER_ACTIVATED:${sessionUser.id}`,
        data: {
            store_slug: validated.storeSlug,
            store_status: updatedUser.store_status,
        },
    });

    const admins = await db.query.users.findMany({
        where: eq(users.role, "ADMIN"),
        columns: { id: true },
    });

    if (updatedUser.store_status === "PENDING_REVIEW") {
        for (const admin of admins) {
            await db.insert(notifications).values({
                user_id: admin.id,
                type: "SELLER_REVIEW_NEEDED",
                title: "Seller Baru Perlu Review",
                message: `${validated.storeName} baru saja mengaktifkan toko dan menunggu review admin.`,
                idempotency_key: `SELLER_REVIEW_NEEDED:${sessionUser.id}:${admin.id}`,
                data: {
                    seller_id: sessionUser.id,
                    store_slug: validated.storeSlug,
                },
            });
        }
    }

    revalidatePath("/seller");
    revalidatePath("/seller/register");
    revalidatePath("/admin/users");
    revalidatePath("/admin/moderation");
    revalidatePath(`/store/${validated.storeSlug}`);

    return {
        success: true,
        redirectTo: "/seller",
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
