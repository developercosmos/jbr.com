"use server";

import { db } from "@/db";
import { integration_settings, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Helper to verify admin access
async function requireAdmin() {
    const session = await auth.api.getSession({
        headers: await headers(),
    });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const user = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
    });

    if (!user || user.role !== "ADMIN") {
        throw new Error("Admin access required");
    }

    return user;
}

// ============================================
// GET ALL INTEGRATION SETTINGS
// ============================================
export async function getIntegrationSettings() {
    await requireAdmin();

    const settings = await db.query.integration_settings.findMany({
        orderBy: (table, { asc }) => [asc(table.category), asc(table.name)],
    });

    // Mask sensitive credentials for display
    return settings.map(setting => ({
        ...setting,
        credentials: setting.credentials
            ? Object.fromEntries(
                Object.entries(setting.credentials).map(([key, val]) => {
                    const value = String(val || "");
                    if (value.length <= 8) {
                        return [key, value ? "****" : ""];
                    }
                    return [key, `${value.slice(0, 4)}${"*".repeat(Math.max(0, value.length - 8))}${value.slice(-4)}`];
                })
            )
            : null,
    }));
}

// ============================================
// GET SINGLE INTEGRATION BY KEY
// ============================================
export async function getIntegrationByKey(key: string) {
    await requireAdmin();

    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });

    if (!setting) {
        return null;
    }

    // Don't mask credentials when fetching single one for editing
    return setting;
}

// ============================================
// UPDATE INTEGRATION SETTINGS
// ============================================
export async function updateIntegration(
    key: string,
    data: {
        enabled?: boolean;
        credentials?: Record<string, string>;
        config?: Record<string, unknown>;
    }
) {
    await requireAdmin();

    const existing = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });

    if (!existing) {
        throw new Error(`Integration ${key} not found`);
    }

    // Merge credentials - only update fields that are provided and not empty
    let newCredentials = existing.credentials || {};
    if (data.credentials) {
        Object.entries(data.credentials).forEach(([k, v]) => {
            if (v && v.trim() !== "" && !v.includes("*")) {
                newCredentials[k] = v;
            }
        });
    }

    // Merge config
    let newConfig = existing.config || {};
    if (data.config) {
        newConfig = { ...newConfig, ...data.config };
    }

    const [updated] = await db
        .update(integration_settings)
        .set({
            enabled: data.enabled ?? existing.enabled,
            credentials: newCredentials,
            config: newConfig,
            updated_at: new Date(),
        })
        .where(eq(integration_settings.key, key))
        .returning();

    revalidatePath("/admin/settings");
    return updated;
}

// ============================================
// TOGGLE INTEGRATION ENABLED STATUS
// ============================================
export async function toggleIntegration(key: string, enabled: boolean) {
    await requireAdmin();

    const [updated] = await db
        .update(integration_settings)
        .set({
            enabled,
            updated_at: new Date(),
        })
        .where(eq(integration_settings.key, key))
        .returning();

    if (!updated) {
        throw new Error(`Integration ${key} not found`);
    }

    revalidatePath("/admin/settings");
    return updated;
}

// ============================================
// SEED DEFAULT INTEGRATIONS
// ============================================
export async function seedDefaultIntegrations() {
    await requireAdmin();

    const defaultIntegrations: Array<{
        key: string;
        name: string;
        description: string;
        category: string;
        enabled: boolean;
        credentials: Record<string, string>;
        config: Record<string, unknown>;
    }> = [
            {
                key: "xendit",
                name: "Xendit",
                description: "Payment gateway untuk transfer bank, e-wallet, QRIS, dan kartu kredit",
                category: "payment",
                enabled: false,
                credentials: {
                    api_key: "",
                    webhook_token: "",
                },
                config: {
                    success_redirect_url: "",
                    failure_redirect_url: "",
                },
            },
            {
                key: "resend",
                name: "Resend",
                description: "Email service untuk notifikasi transaksi dan marketing",
                category: "email",
                enabled: false,
                credentials: {
                    api_key: "",
                },
                config: {
                    from_email: "noreply@jualbeliraket.com",
                    from_name: "JualBeliRaket",
                },
            },
            {
                key: "rajaongkir",
                name: "RajaOngkir",
                description: "Aggregator untuk cek ongkos kirim berbagai ekspedisi",
                category: "shipping",
                enabled: false,
                credentials: {
                    api_key: "",
                },
                config: {
                    account_type: "starter", // starter, basic, pro
                },
            },
        ];

    for (const integration of defaultIntegrations) {
        const existing = await db.query.integration_settings.findFirst({
            where: eq(integration_settings.key, integration.key),
        });

        if (!existing) {
            await db.insert(integration_settings).values({
                key: integration.key,
                name: integration.name,
                description: integration.description,
                category: integration.category,
                enabled: integration.enabled,
                credentials: integration.credentials,
                config: integration.config,
            });
        }
    }

    revalidatePath("/admin/settings");
    return { success: true };
}

// ============================================
// CHECK IF INTEGRATION IS ENABLED (for use in other parts of app)
// ============================================
export async function isIntegrationEnabled(key: string): Promise<boolean> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });

    return setting?.enabled ?? false;
}

// ============================================
// GET INTEGRATION CREDENTIALS (for use in other parts of app)
// ============================================
export async function getIntegrationCredentials(key: string): Promise<Record<string, string> | null> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });

    if (!setting?.enabled) {
        return null;
    }

    return setting.credentials;
}
