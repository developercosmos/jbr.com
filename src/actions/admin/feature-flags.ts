"use server";

import { db } from "@/db";
import { feature_flags, feature_flag_audit_log, feature_flag_kill_switch, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { invalidateFeatureFlagCache, listFeatureFlagDefinitions } from "@/lib/feature-flags";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

const FLAG_REGISTRY = [
    { key: "pdp.inline_offer", description: "Inline offer input di sidebar PDP (PDP-02)", category: "pdp" },
    { key: "pdp.offer_rate_limit", description: "Per-(buyer,product) offer rate limit (PDP-02b)", category: "pdp" },
    { key: "pdp.seller_badges", description: "Seller trust badges di PDP (PDP-03)", category: "pdp" },
    { key: "pdp.seller_join_date", description: "Seller join date display (PDP-04)", category: "pdp" },
    { key: "pdp.review_thumbnail", description: "Review product thumbnail via CACHE-03 (PDP-05)", category: "pdp" },
    { key: "pdp.buyer_rating", description: "Seller rates buyer flow (PDP-08)", category: "trust" },
    { key: "pdp.buyer_reputation", description: "Buyer reputation aggregation (PDP-09)", category: "trust" },
    { key: "pdp.dispute_rating", description: "Dispute buyer rating workflow (PDP-10)", category: "trust" },
    { key: "dif.smart_offer_guardrail", description: "Smart offer guardrail + win probability (DIF-01)", category: "differentiator" },
    { key: "dif.seller_reliability_score", description: "Seller reliability composite score (DIF-02)", category: "differentiator" },
    { key: "dif.offer_sla", description: "Offer SLA + auto follow-up (DIF-03)", category: "differentiator" },
    { key: "dif.condition_checklist", description: "Verified condition checklist pre-loved (DIF-04)", category: "differentiator" },
    { key: "dif.compare_mode", description: "PDP compare mode (DIF-05)", category: "differentiator" },
    { key: "dif.negotiation_insights", description: "Negotiation insights dashboard (DIF-06)", category: "differentiator" },
    { key: "dif.two_way_reputation_surface", description: "Two-way reputation UI surface (DIF-07)", category: "differentiator" },
    { key: "dif.live_presence", description: "Live buyer presence indicator (DIF-08)", category: "differentiator" },
    { key: "dif.auto_counter", description: "Auto-counter offer with floor price (DIF-09)", category: "differentiator" },
    { key: "dif.trust_insurance", description: "Trust insurance Bayar Aman+ (DIF-10)", category: "differentiator" },
    { key: "dif.audit_replay", description: "Negotiation audit replay (DIF-11)", category: "differentiator" },
    { key: "dif.smart_questions", description: "Smart question suggester chat (DIF-12)", category: "differentiator" },
    { key: "dif.intent_score", description: "PDP time-on-page intent score (DIF-13)", category: "differentiator" },
    { key: "dif.tier_floor_price", description: "Personalized tier floor price (DIF-14)", category: "differentiator" },
    { key: "dif.match_score", description: "Match score recommendation (DIF-15)", category: "differentiator" },
    { key: "dif.offer_expiry_warning", description: "Highlight tawaran yang akan kedaluwarsa < 6 jam (DIF-16)", category: "differentiator" },
] as const;

const audienceSchema = z.object({
    roles: z.array(z.string().trim().max(40)).max(20).optional(),
    userIds: z.array(z.string().trim().max(120)).max(200).optional(),
    cohorts: z.array(z.string().trim().max(60)).max(20).optional(),
});

const variantsSchema = z.record(z.string().trim().min(1).max(40), z.number().int().min(0).max(100));

const updateFlagSchema = z.object({
    key: z.string().min(1),
    reason: z.string().trim().min(3).max(300),
    rolloutPct: z.number().int().min(0).max(100).optional(),
    owner: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(2000).optional(),
    parentKey: z.string().trim().max(120).nullable().optional(),
    scheduledEnableAt: z.string().nullable().optional(),
    scheduledDisableAt: z.string().nullable().optional(),
    audience: audienceSchema.optional(),
    variants: variantsSchema.nullable().optional(),
    /**
     * For trust-category flags only: typed confirmation phrase that the admin
     * understands the risk. We require literal "SAYA YAKIN" as a soft 2FA
     * substitute until the auth layer ships TOTP.
     */
    confirmationPhrase: z.string().trim().max(120).optional(),
});

const killSwitchSchema = z.object({
    scope: z.enum(["all-new", "pdp-only", "differentiator-only"]),
    reason: z.string().trim().min(3).max(300),
    confirmationPhrase: z.string().trim().max(120).optional(),
});

const TRUST_CONFIRMATION_PHRASE = "SAYA YAKIN";

function isTrustCategory(category: string | null | undefined): boolean {
    return category === "trust";
}

function assertTrustConfirmation(category: string | null | undefined, phrase: string | undefined) {
    if (!isTrustCategory(category)) return;
    if ((phrase ?? "").toUpperCase() !== TRUST_CONFIRMATION_PHRASE) {
        throw new Error(
            `Flag kategori 'trust' membutuhkan konfirmasi: ketik "${TRUST_CONFIRMATION_PHRASE}" pada field konfirmasi.`
        );
    }
}

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const admin = await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Admin access required");
    }
    return admin;
}

async function writeAuditLog(input: {
    flagKey: string;
    changedBy: string;
    beforeState: Record<string, unknown>;
    afterState: Record<string, unknown>;
    reason: string;
    confirmationPhrase?: string | null;
}) {
    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for") ?? "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const userAgent = hdrs.get("user-agent");

    await db.insert(feature_flag_audit_log).values({
        flag_key: input.flagKey,
        changed_by: input.changedBy,
        before_state: input.beforeState,
        after_state: input.afterState,
        reason: input.reason,
        ip_address: ipAddress,
        user_agent: userAgent,
        confirmation_phrase: input.confirmationPhrase ?? null,
    });
}

async function revalidateFlagSurfaces() {
    await invalidateFeatureFlagCache();
    revalidatePath("/admin/feature-flags");
    revalidatePath("/admin/feature-flags/audit");
    revalidatePath("/admin/feature-flags/kill-switch");
}

export async function ensureInitialFeatureFlags() {
    await requireAdmin();

    await db.insert(feature_flags).values(
        FLAG_REGISTRY.map((flag) => ({
            key: flag.key,
            description: flag.description,
            category: flag.category,
            owner: "TBD",
            audience: {},
        }))
    ).onConflictDoNothing({
        target: feature_flags.key,
    });

    await db.insert(feature_flag_kill_switch).values({
        id: 1,
        active: false,
        scope: "all-new",
    }).onConflictDoNothing({
        target: feature_flag_kill_switch.id,
    });

    await db
        .update(feature_flags)
        .set({ parent_key: "pdp.offer_rate_limit", updated_at: new Date() })
        .where(eq(feature_flags.key, "pdp.inline_offer"));
    await db
        .update(feature_flags)
        .set({ parent_key: "pdp.buyer_reputation", updated_at: new Date() })
        .where(eq(feature_flags.key, "dif.tier_floor_price"));
    await db
        .update(feature_flags)
        .set({ parent_key: "pdp.buyer_rating", updated_at: new Date() })
        .where(or(eq(feature_flags.key, "dif.two_way_reputation_surface"), eq(feature_flags.key, "pdp.dispute_rating")));

    await invalidateFeatureFlagCache();
    return { seeded: true };
}

export async function listAdminFeatureFlags(filters?: { category?: string; search?: string }) {
    await requireAdmin();

    const conditions = [];
    if (filters?.category && filters.category !== "all") {
        conditions.push(eq(feature_flags.category, filters.category));
    }
    if (filters?.search) {
        const q = `%${filters.search.trim()}%`;
        conditions.push(or(ilike(feature_flags.key, q), ilike(feature_flags.description, q), ilike(feature_flags.owner, q))!);
    }

    const rows = await db.query.feature_flags.findMany({
        where: conditions.length > 1 ? and(...conditions) : conditions[0],
        orderBy: (table, { asc }) => [asc(table.category), asc(table.key)],
    });

    const killSwitch = await db.query.feature_flag_kill_switch.findFirst({
        where: eq(feature_flag_kill_switch.id, 1),
    });

    return { flags: rows, killSwitch };
}

export async function getFeatureFlagAuditLog(options?: { key?: string; limit?: number }) {
    await requireAdmin();
    const limit = Math.max(1, Math.min(options?.limit ?? 100, 200));

    // NOTE: tidak gunakan `with: { changedByUser }` karena relasi tidak
    // didefinisikan di schema (feature_flag_audit_log belum punya relations
    // export). Drizzle akan throw "Cannot read properties of undefined
    // (reading 'referencedTable')" saat ada row di tabel. Kalau butuh
    // user object, lakukan lookup terpisah di caller.
    return db.query.feature_flag_audit_log.findMany({
        where: options?.key ? eq(feature_flag_audit_log.flag_key, options.key) : undefined,
        orderBy: [desc(feature_flag_audit_log.created_at)],
        limit,
    });
}

export async function toggleFeatureFlag(
    key: string,
    enabled: boolean,
    reason: string,
    options?: { confirmationPhrase?: string }
) {
    const admin = await requireAdmin();
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
        throw new Error("Alasan perubahan minimal 3 karakter.");
    }

    const existing = await db.query.feature_flags.findFirst({
        where: eq(feature_flags.key, key),
    });
    if (!existing) {
        throw new Error("Feature flag tidak ditemukan.");
    }

    assertTrustConfirmation(existing.category, options?.confirmationPhrase);

    const [updated] = await db
        .update(feature_flags)
        .set({
            enabled,
            updated_at: new Date(),
            updated_by: admin.id,
            last_toggled_at: new Date(),
        })
        .where(eq(feature_flags.key, key))
        .returning();

    await writeAuditLog({
        flagKey: key,
        changedBy: admin.id,
        beforeState: existing as unknown as Record<string, unknown>,
        afterState: updated as unknown as Record<string, unknown>,
        reason: cleanReason,
        confirmationPhrase: options?.confirmationPhrase ?? null,
    });

    await revalidateFlagSurfaces();
    return updated;
}

export async function updateFeatureFlag(input: z.infer<typeof updateFlagSchema>) {
    const admin = await requireAdmin();
    const validated = updateFlagSchema.parse(input);

    const existing = await db.query.feature_flags.findFirst({
        where: eq(feature_flags.key, validated.key),
    });
    if (!existing) {
        throw new Error("Feature flag tidak ditemukan.");
    }

    assertTrustConfirmation(existing.category, validated.confirmationPhrase);

    const scheduledEnableAt = validated.scheduledEnableAt ? new Date(validated.scheduledEnableAt) : null;
    const scheduledDisableAt = validated.scheduledDisableAt ? new Date(validated.scheduledDisableAt) : null;

    // Variant weights must sum to <= 100. Reject malformed configs early.
    if (validated.variants && Object.keys(validated.variants).length > 0) {
        const sum = Object.values(validated.variants).reduce((acc, v) => acc + v, 0);
        if (sum > 100) {
            throw new Error("Total bobot variant tidak boleh melebihi 100%.");
        }
    }

    const [updated] = await db
        .update(feature_flags)
        .set({
            rollout_pct: validated.rolloutPct ?? existing.rollout_pct,
            owner: validated.owner ?? existing.owner,
            notes: validated.notes ?? existing.notes,
            parent_key: validated.parentKey === undefined ? existing.parent_key : validated.parentKey,
            scheduled_enable_at: scheduledEnableAt,
            scheduled_disable_at: scheduledDisableAt,
            audience: validated.audience ?? (existing.audience as Record<string, unknown>),
            variants:
                validated.variants === null
                    ? null
                    : validated.variants ?? (existing.variants as Record<string, number> | null),
            updated_at: new Date(),
            updated_by: admin.id,
        })
        .where(eq(feature_flags.key, validated.key))
        .returning();

    await writeAuditLog({
        flagKey: validated.key,
        changedBy: admin.id,
        beforeState: existing as unknown as Record<string, unknown>,
        afterState: updated as unknown as Record<string, unknown>,
        reason: validated.reason,
        confirmationPhrase: validated.confirmationPhrase ?? null,
    });

    await revalidateFlagSurfaces();
    return updated;
}

export async function activateFeatureFlagKillSwitch(input: z.infer<typeof killSwitchSchema>) {
    const admin = await requireAdmin();
    const validated = killSwitchSchema.parse(input);
    if ((validated.confirmationPhrase ?? "").toUpperCase() !== "MATIKAN SEMUA") {
        throw new Error("Kill-switch wajib konfirmasi: ketik 'MATIKAN SEMUA'.");
    }
    const existing = await db.query.feature_flag_kill_switch.findFirst({ where: eq(feature_flag_kill_switch.id, 1) });

    const [updated] = await db
        .update(feature_flag_kill_switch)
        .set({
            active: true,
            scope: validated.scope,
            activated_by: admin.id,
            activated_at: new Date(),
            reason: validated.reason,
        })
        .where(eq(feature_flag_kill_switch.id, 1))
        .returning();

    await writeAuditLog({
        flagKey: "__kill_switch__",
        changedBy: admin.id,
        beforeState: (existing ?? {}) as Record<string, unknown>,
        afterState: updated as unknown as Record<string, unknown>,
        reason: validated.reason,
        confirmationPhrase: validated.confirmationPhrase ?? null,
    });

    await revalidateFlagSurfaces();
    return updated;
}

export async function deactivateFeatureFlagKillSwitch(reason: string) {
    const admin = await requireAdmin();
    const cleanReason = reason.trim();
    if (cleanReason.length < 3) {
        throw new Error("Alasan perubahan minimal 3 karakter.");
    }

    const existing = await db.query.feature_flag_kill_switch.findFirst({ where: eq(feature_flag_kill_switch.id, 1) });
    const [updated] = await db
        .update(feature_flag_kill_switch)
        .set({
            active: false,
            activated_by: admin.id,
            activated_at: new Date(),
            reason: cleanReason,
        })
        .where(eq(feature_flag_kill_switch.id, 1))
        .returning();

    await writeAuditLog({
        flagKey: "__kill_switch__",
        changedBy: admin.id,
        beforeState: (existing ?? {}) as Record<string, unknown>,
        afterState: updated as unknown as Record<string, unknown>,
        reason: cleanReason,
    });

    await revalidateFlagSurfaces();
    return updated;
}

export async function getFeatureFlagRegistryCount() {
    await requireAdmin();
    const flags = await listFeatureFlagDefinitions();
    return flags.length;
}