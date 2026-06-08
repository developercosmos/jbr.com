"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
    resolveNotificationPreferences,
    type NotificationPreferences,
} from "@/lib/notification-preferences";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
    const user = await getCurrentUser();
    const row = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { notification_preferences: true, email_promo_opt_in: true },
    });
    return resolveNotificationPreferences(row?.notification_preferences, row?.email_promo_opt_in);
}

export async function updateNotificationPreferences(
    input: NotificationPreferences
): Promise<{ success: boolean; preferences: NotificationPreferences }> {
    const user = await getCurrentUser();

    // Re-resolve over defaults: drops unknown keys and coerces shape, so a
    // malformed client payload can never persist garbage.
    const clean = resolveNotificationPreferences(input);

    await db
        .update(users)
        .set({
            notification_preferences: clean,
            // Keep the legacy single flag in sync with the promo email channel.
            email_promo_opt_in: clean.promotions.email,
            updated_at: new Date(),
        })
        .where(eq(users.id, user.id));

    revalidatePath("/profile/settings");
    return { success: true, preferences: clean };
}
