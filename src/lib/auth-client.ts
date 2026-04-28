import { createAuthClient } from "better-auth/react";

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
