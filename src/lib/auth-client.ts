import { createAuthClient } from "better-auth/react";

/**
 * NOTE: we deliberately do NOT use `inferAdditionalFields<typeof auth>()` here.
 * It pulled the entire server-side `auth` config graph (including the BullMQ
 * `lib/queue` import chain via lib/email and the Postgres pool) into the
 * client-side TS resolution path. While the actual JS for those servers
 * imports gets tree-shaken, the resulting `useSession` shape became unstable
 * across renders and caused a "Maximum update depth exceeded" loop
 * (React minified error #185) on authenticated pages.
 *
 * Server-side `user.additionalFields` (in lib/auth.ts) still ensures role/tier
 * are returned in the session payload. Client code that reads them does a
 * narrow `as { role?: string }` cast at the call site — see Navbar.tsx.
 */
export const authClient = createAuthClient({
    // Use relative URL so it works on any port
    baseURL: typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    sessionOptions: {
        // Avoid extra session refetch bursts when tab focus changes.
        refetchOnWindowFocus: false,
    },
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;
