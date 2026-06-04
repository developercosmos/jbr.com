import { betterAuth } from "better-auth";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "./email";

// Create database pool with explicit configuration
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

const tiktokClientKey = process.env.TIKTOK_CLIENT_KEY || process.env.TIKTOK_CLIENT_ID || "";
const tiktokClientSecret = process.env.TIKTOK_CLIENT_SECRET || "";

// Build social providers conditionally — only register a provider when its
// credentials are present, so the sign-in buttons can be feature-gated to match.
const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};
if (googleClientId && googleClientSecret) {
    socialProviders.google = {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
        // Let returning users link a Google login to an existing email/password
        // account with the same verified email instead of erroring out.
        mapProfileToUser: (profile) => ({
            name: profile.name,
            email: profile.email,
            image: profile.picture,
            emailVerified: profile.email_verified ?? false,
        }),
    };
}
if (tiktokClientKey && tiktokClientSecret) {
    socialProviders.tiktok = {
        clientKey: tiktokClientKey,
        clientSecret: tiktokClientSecret,
    };
}

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
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
        expiresIn: 60 * 60 * 24,
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
        // Expose extra columns through session.user so the client can read
        // `session.user.role` for admin gating, `tier` for KYC banding, etc.
        additionalFields: {
            role: { type: "string", required: false, defaultValue: "USER", input: false },
            tier: { type: "string", required: false, defaultValue: "T0", input: false },
            phone: { type: "string", required: false, input: false },
            locale: { type: "string", required: false, defaultValue: "id-ID", input: false },
            store_slug: { type: "string", required: false, input: false },
            store_name: { type: "string", required: false, input: false },
            store_status: { type: "string", required: false, input: false },
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
        // Dynamic from environment variables
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        // Production explicit allowlist to avoid env drift causing social sign-in 403
        "https://jualbeliraket.com",
        "https://www.jualbeliraket.com",
        // Development fallback
        "http://localhost:3000",
    ].filter((origin): origin is string => Boolean(origin)),
});

export type Session = typeof auth.$Infer.Session;

