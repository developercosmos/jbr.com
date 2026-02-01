import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Lazy initialization - only create auth instance when actually needed at runtime
let _auth: ReturnType<typeof betterAuth> | null = null;

function getAuth() {
    if (!_auth) {
        _auth = betterAuth({
            secret: process.env.BETTER_AUTH_SECRET,
            database: drizzleAdapter(db, {
                provider: "pg",
                schema: {
                    user: schema.users,
                    session: schema.sessions,
                    account: schema.accounts,
                    verification: schema.verifications,
                },
            }),
            emailAndPassword: {
                enabled: true,
            },
            trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
        });
    }
    return _auth;
}

// Export a proxy that delegates to the lazy-initialized auth
export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
    get(_, prop) {
        return (getAuth() as unknown as Record<string | symbol, unknown>)[prop];
    },
});

export type Session = typeof auth.$Infer.Session;
