"use server";

import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function serverSignOut() {
    try {
        // Get current session
        const session = await auth.api.getSession({ headers: await headers() });

        if (session?.session?.id) {
            // Delete session from database directly
            await db.delete(sessions).where(eq(sessions.id, session.session.id));
        }

        // Clear auth cookies
        const cookieStore = await cookies();
        for (const cookie of cookieStore.getAll()) {
            if (cookie.name.startsWith("better-auth")) {
                cookieStore.delete(cookie.name);
            }
        }

        revalidatePath("/");
        revalidatePath("/profile");
        revalidatePath("/profile/settings");

        return { success: true };
    } catch (error) {
        console.error("[serverSignOut] Error:", error);
        return { success: false, error: "Failed to sign out" };
    }
}

