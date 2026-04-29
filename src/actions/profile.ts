"use server";

import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decryptPdpField, encryptPdpField } from "@/lib/crypto/pdp-field";
import bcrypt from "bcryptjs";
import { isS3Configured, storageConfig } from "@/lib/storage";

const phonePattern = /^(?:\+62|62|0)[0-9]{8,13}$/;

const updateProfileSchema = z.object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(80, "Nama terlalu panjang"),
    phone: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || "")
        .refine((value) => value === "" || phonePattern.test(value.replace(/[\s-]/g, "")), "Format nomor telepon tidak valid"),
    avatarUrl: z
        .string()
        .trim()
        .optional()
        .transform((value) => value || "")
        .refine((value) => value === "" || isAllowedAvatarUrl(value), "Avatar harus berasal dari domain aplikasi atau bucket S3 yang dikonfigurasi"),
    locale: z.enum(["id-ID", "en-US"]),
    currentPassword: z
        .string()
        .optional()
        .transform((value) => value || ""),
    newPassword: z
        .string()
        .optional()
        .transform((value) => value || "")
        .refine((value) => value === "" || value.length >= 6, "Password baru minimal 6 karakter"),
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

function isAllowedAvatarUrl(value: string) {
    if (value.startsWith("/")) {
        return true;
    }

    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com";
        const allowedOrigin = new URL(appUrl).origin;
        const avatarUrl = new URL(value);
        if (avatarUrl.origin === allowedOrigin) {
            return true;
        }

        if (isS3Configured()) {
            const s3Host = `${storageConfig.s3.bucket}.s3.${storageConfig.s3.region}.amazonaws.com`;
            if (avatarUrl.hostname === s3Host) {
                return true;
            }
        }

        return false;
    } catch (error) {
        console.warn("isAllowedAvatarUrl rejected value:", { value, error });
        return false;
    }
}

export async function updateProfile(input: z.input<typeof updateProfileSchema>) {
    const sessionUser = await getCurrentUser();
    const parsed = updateProfileSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false as const,
            fieldErrors: parsed.error.flatten().fieldErrors,
        };
    }

    const validated = parsed.data;

    if (validated.newPassword && !validated.currentPassword) {
        return {
            success: false as const,
            fieldErrors: {
                currentPassword: ["Password saat ini wajib diisi untuk mengganti password"],
            },
        };
    }

    if (validated.newPassword) {
        const credentialAccount = await db.query.accounts.findFirst({
            where: and(
                eq(accounts.user_id, sessionUser.id),
                eq(accounts.provider_id, "credential")
            ),
            columns: {
                id: true,
                password: true,
            },
        });

        if (!credentialAccount?.password) {
            return {
                success: false as const,
                fieldErrors: {
                    currentPassword: ["Akun ini tidak memiliki password lokal"],
                },
            };
        }

        const isCurrentPasswordValid = await bcrypt.compare(validated.currentPassword, credentialAccount.password);
        if (!isCurrentPasswordValid) {
            return {
                success: false as const,
                fieldErrors: {
                    currentPassword: ["Password saat ini tidak sesuai"],
                },
            };
        }

        const hashedNewPassword = await bcrypt.hash(validated.newPassword, 10);
        await db
            .update(accounts)
            .set({
                password: hashedNewPassword,
                updated_at: new Date(),
            })
            .where(eq(accounts.id, credentialAccount.id));
    }

    const [updatedUser] = await db
        .update(users)
        .set({
            name: validated.name,
            phone: encryptPdpField(validated.phone),
            image: validated.avatarUrl || null,
            locale: validated.locale,
            updated_at: new Date(),
        })
        .where(eq(users.id, sessionUser.id))
        .returning({
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
            phone: users.phone,
            locale: users.locale,
        });

    revalidatePath("/profile");
    revalidatePath("/profile/settings");
    revalidatePath("/");

    return {
        success: true as const,
        user: {
            ...updatedUser,
            phone: decryptPdpField(updatedUser.phone),
        },
    };
}
