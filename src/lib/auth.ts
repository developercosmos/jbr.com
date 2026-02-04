import { betterAuth } from "better-auth";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// Create a PostgreSQL pool for Better Auth (bypasses Drizzle adapter issues)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Production security settings
const isProduction = process.env.NODE_ENV === "production";

// Direct initialization - Better Auth handles lazy loading internally
export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    database: pool,
    emailAndPassword: {
        enabled: true,
        // Require minimum password length
        minPasswordLength: 8,
        // Use bcrypt for password hashing (compatible with seeded data)
        password: {
            hash: async (password: string) => {
                return await bcrypt.hash(password, 10);
            },
            verify: async ({ hash, password }: { hash: string; password: string }) => {
                return await bcrypt.compare(password, hash);
            },
        },
    },
    // Map table names to match existing database schema (plural, snake_case)
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
        // Session expires after 7 days of inactivity
        expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
        // Update session expiry on each request
        updateAge: 60 * 60 * 24, // Update every 24 hours
        // Cookie settings for security
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5, // 5 minutes cache
        },
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
    // Rate limiting for auth endpoints (brute force protection)
    rateLimit: {
        enabled: true,
        window: 60, // 1 minute window
        max: 10, // Max 10 attempts per window
    },
    // Advanced security options
    advanced: {
        // Use secure cookies in production
        useSecureCookies: isProduction,
        // Generate secure session tokens
        generateId: () => crypto.randomUUID(),
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
