/**
 * Server-only readers for integration_settings. These return RAW credentials
 * (payment/SMTP/courier keys) and MUST NOT live in a "use server" module — every
 * export there is registered as an anonymously-callable Server Action, which would
 * leak the keys to any unauthenticated caller. `server-only` makes an accidental
 * client import fail the build.
 */
import "server-only";
import { db } from "@/db";
import { integration_settings } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function isIntegrationEnabled(key: string): Promise<boolean> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });
    return setting?.enabled ?? false;
}

export async function getIntegrationCredentials(key: string): Promise<Record<string, string> | null> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, key),
    });
    if (!setting?.enabled) return null;
    return setting.credentials;
}

export async function getSiteConfig(): Promise<{
    app_url: string;
    app_name: string;
    support_email: string;
}> {
    const setting = await db.query.integration_settings.findFirst({
        where: eq(integration_settings.key, "site_config"),
    });
    const defaults = {
        app_url: process.env.NEXT_PUBLIC_APP_URL || "https://jualbeliraket.com",
        app_name: "JualBeliRaket",
        support_email: "support@jualbeliraket.com",
    };
    if (!setting?.config) return defaults;
    const config = setting.config as Record<string, unknown>;
    return {
        app_url: (config.app_url as string) || defaults.app_url,
        app_name: (config.app_name as string) || defaults.app_name,
        support_email: (config.support_email as string) || defaults.support_email,
    };
}
