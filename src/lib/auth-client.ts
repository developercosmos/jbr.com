import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
    // Use relative URL so it works on any port
    baseURL: typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
    sessionOptions: {
        // Avoid extra session refetch bursts when tab focus changes.
        refetchOnWindowFocus: false,
    },
    // Mirror server-side `user.additionalFields` so the client typing for
    // session.user.role, tier, etc. matches what the server returns.
    plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
    signIn,
    signUp,
    signOut,
    useSession,
    getSession,
} = authClient;
