"use server";

import { db } from "@/db";
import { users, verifications, accounts } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
    sendPasswordResetEmail,
    sendWelcomeEmail,
    sendVerificationEmail
} from "@/lib/email";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { revalidatePath } from "next/cache";

// ============================================
// FORGOT PASSWORD / PASSWORD RESET
// ============================================

export async function requestPasswordReset(email: string) {
    try {
        // Find user by email
        const user = await db.query.users.findFirst({
            where: eq(users.email, email.toLowerCase().trim()),
        });

        // Always return success to prevent email enumeration
        if (!user) {
            return { success: true };
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing reset tokens for this email
        await db.delete(verifications).where(
            and(
                eq(verifications.identifier, email.toLowerCase()),
                eq(verifications.value, "password_reset")
            )
        );

        // Insert new reset token - use 'value' column for token type, identifier for token
        await db.insert(verifications).values({
            id: crypto.randomUUID(),
            identifier: token, // Store token in identifier
            value: `password_reset:${email.toLowerCase()}`, // Store type and email in value
            expires_at: expiresAt,
            created_at: new Date(),
            updated_at: new Date(),
        });

        // Send email
        await sendPasswordResetEmail(email, token, user.name || undefined);

        return { success: true };
    } catch (error) {
        console.error("Password reset request error:", error);
        return { success: false, error: "Terjadi kesalahan. Silakan coba lagi." };
    }
}

export async function resetPassword(token: string, newPassword: string) {
    try {
        if (!token || !newPassword) {
            return { success: false, error: "Token dan password diperlukan." };
        }

        if (newPassword.length < 6) {
            return { success: false, error: "Password minimal 6 karakter." };
        }

        // Find valid token
        const verification = await db.query.verifications.findFirst({
            where: and(
                eq(verifications.identifier, token),
                gt(verifications.expires_at, new Date())
            ),
        });

        if (!verification || !verification.value.startsWith("password_reset:")) {
            return { success: false, error: "Link reset password tidak valid atau sudah kedaluwarsa." };
        }

        // Extract email from value
        const email = verification.value.replace("password_reset:", "");

        // Find user
        const user = await db.query.users.findFirst({
            where: eq(users.email, email),
        });

        if (!user) {
            return { success: false, error: "User tidak ditemukan." };
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in accounts table (better-auth stores password there)
        await db.update(accounts)
            .set({
                password: hashedPassword,
                updated_at: new Date()
            })
            .where(
                and(
                    eq(accounts.user_id, user.id),
                    eq(accounts.provider_id, "credential")
                )
            );

        // Delete the used token
        await db.delete(verifications).where(eq(verifications.identifier, token));

        return { success: true };
    } catch (error) {
        console.error("Password reset error:", error);
        return { success: false, error: "Terjadi kesalahan. Silakan coba lagi." };
    }
}

// ============================================
// EMAIL VERIFICATION
// ============================================

export async function requestEmailVerification(userId: string) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!user || !user.email) {
            return { success: false, error: "User tidak ditemukan." };
        }

        if (user.email_verified) {
            return { success: false, error: "Email sudah terverifikasi." };
        }

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Delete existing verification tokens
        await db.delete(verifications).where(
            and(
                eq(verifications.value, `email_verify:${user.email.toLowerCase()}`)
            )
        );

        // Insert new token
        await db.insert(verifications).values({
            id: crypto.randomUUID(),
            identifier: token,
            value: `email_verify:${user.email.toLowerCase()}`,
            expires_at: expiresAt,
            created_at: new Date(),
            updated_at: new Date(),
        });

        // Send email
        await sendVerificationEmail(user.email, token, user.name || undefined);

        return { success: true };
    } catch (error) {
        console.error("Email verification request error:", error);
        return { success: false, error: "Terjadi kesalahan. Silakan coba lagi." };
    }
}

export async function verifyEmail(token: string) {
    try {
        if (!token) {
            return { success: false, error: "Token verifikasi diperlukan." };
        }

        // Find valid token
        const verification = await db.query.verifications.findFirst({
            where: and(
                eq(verifications.identifier, token),
                gt(verifications.expires_at, new Date())
            ),
        });

        if (!verification || !verification.value.startsWith("email_verify:")) {
            return { success: false, error: "Link verifikasi tidak valid atau sudah kedaluwarsa." };
        }

        // Extract email
        const email = verification.value.replace("email_verify:", "");

        // Update user
        await db.update(users)
            .set({
                email_verified: true,
                updated_at: new Date()
            })
            .where(eq(users.email, email));

        // Delete token
        await db.delete(verifications).where(eq(verifications.identifier, token));

        revalidatePath("/");
        return { success: true };
    } catch (error) {
        console.error("Email verification error:", error);
        return { success: false, error: "Terjadi kesalahan. Silakan coba lagi." };
    }
}

// ============================================
// WELCOME EMAIL (called after registration)
// ============================================

export async function sendWelcomeEmailAction(userId: string) {
    try {
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId),
        });

        if (!user || !user.email) {
            return { success: false };
        }

        await sendWelcomeEmail(user.email, user.name || "Pengguna");
        return { success: true };
    } catch (error) {
        console.error("Welcome email error:", error);
        return { success: false };
    }
}
