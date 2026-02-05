import { betterAuth } from "better-auth";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "./email";

// Create database pool with explicit configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 6,
        requireEmailVerification: true,
        password: {
            hash: async (password: string) => {
                return bcrypt.hash(password, 10);
            },
            verify: async ({ password, hash }: { password: string; hash: string }) => {
                return bcrypt.compare(password, hash);
            },
        },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url, token }) => {
            console.log(`[Auth] Sending verification email to ${user.email}`);
            await sendVerificationEmail(user.email, token, user.name || undefined);
        },
    },
    // Map to existing database schema (snake_case)
    user: {
        modelName: "users",
        fields: {
            emailVerified: "email_verified",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    session: {
        modelName: "sessions",
        fields: {
            userId: "user_id",
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
            ipAddress: "ip_address",
            userAgent: "user_agent",
        },
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day
    },
    account: {
        modelName: "accounts",
        fields: {
            userId: "user_id",
            accountId: "account_id",
            providerId: "provider_id",
            accessToken: "access_token",
            refreshToken: "refresh_token",
            accessTokenExpiresAt: "access_token_expires_at",
            refreshTokenExpiresAt: "refresh_token_expires_at",
            idToken: "id_token",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    verification: {
        modelName: "verifications",
        fields: {
            expiresAt: "expires_at",
            createdAt: "created_at",
            updatedAt: "updated_at",
        },
    },
    trustedOrigins: [
        // Production domains
        "https://jualbeliraket.com",
        "https://www.jualbeliraket.com",
        // Environment-specific URL
        process.env.BETTER_AUTH_URL || "http://localhost:3000",
        process.env.NEXT_PUBLIC_APP_URL || "",
        // Development
        "http://localhost:3000",
    ].filter(Boolean),
});

export type Session = typeof auth.$Infer.Session;

