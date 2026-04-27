"use server";

import { db } from "@/db";
import { users, vouchers, voucher_redemptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

async function requireAdmin() {
    const user = await getCurrentUser();
    const admin = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, role: true },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Admin access required");
    }
    return admin;
}

const createVoucherSchema = z.object({
    code: z
        .string()
        .min(3)
        .max(40)
        .regex(/^[A-Z0-9_-]+$/i, "Kode hanya boleh huruf, angka, underscore, dan dash"),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.number().min(0),
    max_uses: z.number().int().min(1).nullable().optional(),
    max_uses_per_user: z.number().int().min(1).default(1),
    valid_from: z.string().datetime().optional(),
    valid_to: z.string().datetime().nullable().optional(),
    min_order_amount: z.number().min(0).nullable().optional(),
    scope: z.record(z.string(), z.unknown()).nullable().optional(),
    is_active: z.boolean().default(true),
});

export async function createVoucher(input: z.infer<typeof createVoucherSchema>) {
    await requireAdmin();
    const validated = createVoucherSchema.parse(input);

    if (validated.type === "PERCENT" && validated.value > 100) {
        throw new Error("Voucher PERCENT tidak boleh melebihi 100%.");
    }

    const [created] = await db
        .insert(vouchers)
        .values({
            code: validated.code.toUpperCase(),
            type: validated.type,
            value: String(validated.value),
            max_uses: validated.max_uses ?? null,
            max_uses_per_user: validated.max_uses_per_user,
            valid_from: validated.valid_from ? new Date(validated.valid_from) : new Date(),
            valid_to: validated.valid_to ? new Date(validated.valid_to) : null,
            min_order_amount: validated.min_order_amount !== null && validated.min_order_amount !== undefined
                ? String(validated.min_order_amount)
                : null,
            scope: validated.scope ?? null,
            is_active: validated.is_active,
        })
        .returning();

    revalidatePath("/admin/vouchers");
    return { success: true, voucher: created };
}

export async function revokeVoucher(voucherId: string) {
    await requireAdmin();
    await db
        .update(vouchers)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(vouchers.id, voucherId));
    revalidatePath("/admin/vouchers");
    return { success: true };
}

export async function listVouchers() {
    await requireAdmin();
    return db.query.vouchers.findMany({
        orderBy: [desc(vouchers.created_at)],
    });
}

interface ApplyResult {
    voucherId: string;
    type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
    discountAmount: number;
    freeShipping: boolean;
}

/**
 * Validate and quote a voucher for a checkout in progress. Does NOT redeem;
 * caller must invoke `redeemVoucher` once the order is persisted.
 */
export async function applyVoucher(input: { code: string; subtotal: number; shippingCost: number }): Promise<ApplyResult> {
    const user = await getCurrentUser();
    const code = input.code.trim().toUpperCase();
    if (!code) throw new Error("Kode voucher wajib diisi.");

    const now = new Date();
    const voucher = await db.query.vouchers.findFirst({
        where: and(
            eq(vouchers.code, code),
            eq(vouchers.is_active, true),
            lte(vouchers.valid_from, now),
            or(isNull(vouchers.valid_to), gt(vouchers.valid_to, now))
        ),
    });

    if (!voucher) {
        throw new Error("Voucher tidak ditemukan atau sudah tidak berlaku.");
    }

    if (voucher.min_order_amount !== null && input.subtotal < Number(voucher.min_order_amount)) {
        throw new Error(
            `Minimal belanja ${Number(voucher.min_order_amount).toLocaleString("id-ID")} untuk voucher ini.`
        );
    }

    if (voucher.max_uses !== null) {
        const [globalCount] = await db
            .select({ value: sql<number>`count(*)` })
            .from(voucher_redemptions)
            .where(eq(voucher_redemptions.voucher_id, voucher.id));
        if (Number(globalCount?.value ?? 0) >= voucher.max_uses) {
            throw new Error("Voucher sudah mencapai batas penggunaan.");
        }
    }

    const [perUserCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(voucher_redemptions)
        .where(and(eq(voucher_redemptions.voucher_id, voucher.id), eq(voucher_redemptions.user_id, user.id)));
    if (Number(perUserCount?.value ?? 0) >= voucher.max_uses_per_user) {
        throw new Error("Anda sudah mencapai batas penggunaan voucher ini.");
    }

    let discountAmount = 0;
    let freeShipping = false;
    const value = Number(voucher.value);

    if (voucher.type === "PERCENT") {
        discountAmount = Math.round((input.subtotal * value) / 100);
    } else if (voucher.type === "FIXED") {
        discountAmount = Math.min(Math.round(value), input.subtotal);
    } else if (voucher.type === "FREE_SHIPPING") {
        freeShipping = true;
        discountAmount = input.shippingCost;
    }

    return {
        voucherId: voucher.id,
        type: voucher.type,
        discountAmount,
        freeShipping,
    };
}

/**
 * Persist voucher use after the order row exists. Idempotent on (voucher,user,order).
 */
export async function redeemVoucher(opts: {
    voucherId: string;
    orderId: string;
    appliedAmount: number;
}) {
    const user = await getCurrentUser();
    await db.insert(voucher_redemptions).values({
        voucher_id: opts.voucherId,
        user_id: user.id,
        order_id: opts.orderId,
        applied_amount: String(opts.appliedAmount),
    });
    return { success: true };
}
