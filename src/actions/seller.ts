"use server";

import { db } from "@/db";
import { addresses, notifications, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { canAccessSellerCenter, normalizeStoreSlug } from "@/lib/seller";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";
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
