"use server";

import { db } from "@/db";
import { logger } from "@/lib/logger";
import { actionErrorMessage, isNextControlFlowError } from "@/lib/action-result";
import { addresses } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Get current user
async function getCurrentUser() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

// ============================================
// GET USER ADDRESSES
// ============================================
export async function getUserAddresses(search?: string) {
    const user = await getCurrentUser();

    let userAddresses;

    if (search && search.trim()) {
        const searchTerm = `%${search}%`;
        userAddresses = await db.query.addresses.findMany({
            where: and(
                eq(addresses.user_id, user.id),
                or(
                    ilike(addresses.recipient_name, searchTerm),
                    ilike(addresses.label, searchTerm),
                    ilike(addresses.full_address, searchTerm)
                )
            ),
            orderBy: (addresses, { desc }) => [
                desc(addresses.is_default_shipping),
                desc(addresses.created_at)
            ],
        });
    } else {
        userAddresses = await db.query.addresses.findMany({
            where: eq(addresses.user_id, user.id),
            orderBy: (addresses, { desc }) => [
                desc(addresses.is_default_shipping),
                desc(addresses.created_at)
            ],
        });
    }

    return userAddresses;
}

// ============================================
// GET SINGLE ADDRESS
// ============================================
export async function getAddressById(addressId: string) {
    const user = await getCurrentUser();

    const address = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, addressId),
            eq(addresses.user_id, user.id)
        ),
    });

    return address;
}

// ============================================
// CREATE ADDRESS
// ============================================
const createAddressSchema = z.object({
    label: z.string().min(1, "Label wajib diisi"),
    recipient_name: z.string().min(1, "Nama penerima wajib diisi"),
    phone: z.string().min(1, "Nomor telepon wajib diisi"),
    full_address: z.string().min(1, "Alamat lengkap wajib diisi"),
    postal_code: z.string().optional(),
    province_id: z.number().optional(),
    city_id: z.number().optional(),
    district_id: z.number().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    is_default_shipping: z.boolean().optional(),
    is_default_pickup: z.boolean().optional(),
});

export async function createAddress(input: z.infer<typeof createAddressSchema>) {
    try {
        return await createAddressInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyimpan alamat.");
        logger.warn("address:create_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function createAddressInternal(input: z.infer<typeof createAddressSchema>) {
    const user = await getCurrentUser();
    const validated = createAddressSchema.parse(input);

    // If setting as default, unset other defaults
    if (validated.is_default_shipping) {
        await db
            .update(addresses)
            .set({ is_default_shipping: false })
            .where(eq(addresses.user_id, user.id));
    }

    if (validated.is_default_pickup) {
        await db
            .update(addresses)
            .set({ is_default_pickup: false })
            .where(eq(addresses.user_id, user.id));
    }

    const [newAddress] = await db
        .insert(addresses)
        .values({
            user_id: user.id,
            label: validated.label,
            recipient_name: validated.recipient_name,
            phone: validated.phone,
            full_address: validated.full_address,
            postal_code: validated.postal_code,
            province_id: validated.province_id,
            city_id: validated.city_id,
            district_id: validated.district_id,
            latitude: validated.latitude,
            longitude: validated.longitude,
            is_default_shipping: validated.is_default_shipping ?? false,
            is_default_pickup: validated.is_default_pickup ?? false,
        })
        .returning();

    revalidatePath("/profile/address");
    revalidatePath("/checkout");

    return { success: true as const, address: newAddress };
}

// ============================================
// UPDATE ADDRESS
// ============================================
const updateAddressSchema = z.object({
    id: z.string().uuid(),
    label: z.string().min(1, "Label wajib diisi"),
    recipient_name: z.string().min(1, "Nama penerima wajib diisi"),
    phone: z.string().min(1, "Nomor telepon wajib diisi"),
    full_address: z.string().min(1, "Alamat lengkap wajib diisi"),
    postal_code: z.string().optional(),
    province_id: z.number().optional(),
    city_id: z.number().optional(),
    district_id: z.number().optional(),
    latitude: z.string().optional(),
    longitude: z.string().optional(),
    is_default_shipping: z.boolean().optional(),
    is_default_pickup: z.boolean().optional(),
});

export async function updateAddress(input: z.infer<typeof updateAddressSchema>) {
    try {
        return await updateAddressInternal(input);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menyimpan alamat.");
        logger.warn("address:update_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function updateAddressInternal(input: z.infer<typeof updateAddressSchema>) {
    const user = await getCurrentUser();
    const validated = updateAddressSchema.parse(input);

    // Verify ownership
    const existingAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, validated.id),
            eq(addresses.user_id, user.id)
        ),
    });

    if (!existingAddress) {
        throw new Error("Alamat tidak ditemukan");
    }

    // If setting as default, unset other defaults
    if (validated.is_default_shipping) {
        await db
            .update(addresses)
            .set({ is_default_shipping: false })
            .where(eq(addresses.user_id, user.id));
    }

    if (validated.is_default_pickup) {
        await db
            .update(addresses)
            .set({ is_default_pickup: false })
            .where(eq(addresses.user_id, user.id));
    }

    const [updatedAddress] = await db
        .update(addresses)
        .set({
            label: validated.label,
            recipient_name: validated.recipient_name,
            phone: validated.phone,
            full_address: validated.full_address,
            postal_code: validated.postal_code,
            province_id: validated.province_id,
            city_id: validated.city_id,
            district_id: validated.district_id,
            latitude: validated.latitude,
            longitude: validated.longitude,
            is_default_shipping: validated.is_default_shipping ?? existingAddress.is_default_shipping,
            is_default_pickup: validated.is_default_pickup ?? existingAddress.is_default_pickup,
        })
        .where(eq(addresses.id, validated.id))
        .returning();

    revalidatePath("/profile/address");
    revalidatePath("/checkout");

    return { success: true as const, address: updatedAddress };
}

// ============================================
// DELETE ADDRESS
// ============================================
export async function deleteAddress(addressId: string) {
    try {
        return await deleteAddressInternal(addressId);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal menghapus alamat.");
        logger.warn("address:delete_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function deleteAddressInternal(addressId: string) {
    const user = await getCurrentUser();

    // Verify ownership and check if not default
    const existingAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, addressId),
            eq(addresses.user_id, user.id)
        ),
    });

    if (!existingAddress) {
        throw new Error("Alamat tidak ditemukan");
    }

    if (existingAddress.is_default_shipping) {
        throw new Error("Tidak dapat menghapus alamat utama pengiriman");
    }

    await db.delete(addresses).where(eq(addresses.id, addressId));

    revalidatePath("/profile/address");
    revalidatePath("/checkout");

    return { success: true as const };
}

// ============================================
// SET DEFAULT ADDRESS
// ============================================
export async function setDefaultAddress(addressId: string, type: "shipping" | "pickup") {
    try {
        return await setDefaultAddressInternal(addressId, type);
    } catch (err) {
        if (isNextControlFlowError(err)) throw err;
        const message = actionErrorMessage(err, "Gagal mengatur alamat utama.");
        logger.warn("address:set_default_failed", { error: message });
        return { success: false as const, error: message };
    }
}

async function setDefaultAddressInternal(addressId: string, type: "shipping" | "pickup") {
    const user = await getCurrentUser();

    // Verify ownership
    const existingAddress = await db.query.addresses.findFirst({
        where: and(
            eq(addresses.id, addressId),
            eq(addresses.user_id, user.id)
        ),
    });

    if (!existingAddress) {
        throw new Error("Alamat tidak ditemukan");
    }

    // Unset all defaults of this type
    if (type === "shipping") {
        await db
            .update(addresses)
            .set({ is_default_shipping: false })
            .where(eq(addresses.user_id, user.id));
    } else {
        await db
            .update(addresses)
            .set({ is_default_pickup: false })
            .where(eq(addresses.user_id, user.id));
    }

    // Set new default
    const [updatedAddress] = await db
        .update(addresses)
        .set(type === "shipping"
            ? { is_default_shipping: true }
            : { is_default_pickup: true }
        )
        .where(eq(addresses.id, addressId))
        .returning();

    revalidatePath("/profile/address");
    revalidatePath("/checkout");

    return { success: true as const, address: updatedAddress };
}
