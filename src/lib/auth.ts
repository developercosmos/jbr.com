import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";

export const auth = betterAuth({
    // Provide secret - use fallback during build time
    secret: process.env.BETTER_AUTH_SECRET || 'build-time-placeholder-secret-min-32-chars',
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
    // Email verification disabled - requires email provider setup
    // emailVerification: {
    //     sendOnSignUp: true,
    //     autoSignInAfterVerification: true,
    // },

    // OAuth Providers - DISABLED for now (uncomment when credentials are configured)
    // socialProviders: {
    //     google: {
    //         clientId: process.env.GOOGLE_CLIENT_ID!,
    //         clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    //     },
    //     facebook: {
    //         clientId: process.env.FACEBOOK_CLIENT_ID!,
    //         clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
    //     },
    //     apple: {
    //         clientId: process.env.APPLE_CLIENT_ID!,
    //         clientSecret: process.env.APPLE_CLIENT_SECRET!,
    //     },
    //     twitter: {
    //         clientId: process.env.TWITTER_CLIENT_ID!,
    //         clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    //     },
    // },
    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000"],
});

export type Session = typeof auth.$Infer.Session;
