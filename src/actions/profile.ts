"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
        .refine((value) => value === "" || isAllowedAvatarUrl(value), "Avatar harus berasal dari domain aplikasi"),
    locale: z.enum(["id-ID", "en-US"]),
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
    try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com";
        const allowedOrigin = new URL(appUrl).origin;
        const avatarUrl = new URL(value);
        return avatarUrl.origin === allowedOrigin;
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

    const [updatedUser] = await db
        .update(users)
        .set({
            name: validated.name,
            phone: validated.phone,
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
        user: updatedUser,
    };
}
