"use server";

import { db } from "@/db";
import { feature_flags } from "@/db/schema";
import { invalidateFeatureFlagCache } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";
import { and, eq, isNotNull, lte, gte, sql } from "drizzle-orm";

/**
 * FLAG-09: Auto-toggle flags that have reached their scheduled_enable_at /
 * scheduled_disable_at boundary. Idempotent: if a flag is already in the right
 * state we skip the write.
 *
 * Runs every cron tick. Cache is invalidated once at the end if any row changed.
 */
export async function runFeatureFlagScheduledToggle(): Promise<{
    enabled: number;
    disabled: number;
}> {
    const now = new Date();

    // ENABLE: scheduled_enable_at <= now AND enabled = false.
    const enableTargets = await db
        .select({ key: feature_flags.key })
        .from(feature_flags)
        .where(
            and(
                isNotNull(feature_flags.scheduled_enable_at),
                lte(feature_flags.scheduled_enable_at, now),
                eq(feature_flags.enabled, false)
            )
        );

    let enabledCount = 0;
    for (const row of enableTargets) {
        await db
            .update(feature_flags)
            .set({
                enabled: true,
                last_toggled_at: now,
                updated_at: now,
                scheduled_enable_at: null, // consume the trigger
                notes: sql`COALESCE(${feature_flags.notes}, '') || E'\n[auto-enable ' || ${now.toISOString()} || ']'`,
            })
            .where(eq(feature_flags.key, row.key));
        enabledCount++;
    }

    // DISABLE: scheduled_disable_at <= now AND enabled = true.
    const disableTargets = await db
        .select({ key: feature_flags.key })
        .from(feature_flags)
        .where(
            and(
                isNotNull(feature_flags.scheduled_disable_at),
                lte(feature_flags.scheduled_disable_at, now),
                eq(feature_flags.enabled, true)
            )
        );

    let disabledCount = 0;
    for (const row of disableTargets) {
        await db
            .update(feature_flags)
            .set({
                enabled: false,
                last_toggled_at: now,
                updated_at: now,
                scheduled_disable_at: null,
                notes: sql`COALESCE(${feature_flags.notes}, '') || E'\n[auto-disable ' || ${now.toISOString()} || ']'`,
            })
            .where(eq(feature_flags.key, row.key));
        disabledCount++;
    }

    if (enabledCount + disabledCount > 0) {
        await invalidateFeatureFlagCache();
        logger.info("feature-flags:scheduled_apply", {
            enabled: enabledCount,
            disabled: disabledCount,
        });
    }

    return { enabled: enabledCount, disabled: disabledCount };
}

/**
 * FLAG-12: Warn flags idle in stable end-state (0% or 100%) for 60+ days.
 *
 * This sweep just emits a structured log line per candidate; ops dashboard or
 * Sentry can route the alert. Production-safe to keep in nightly cron.
 */
export async function runFeatureFlagCleanupNotices(): Promise<{
    flagged: string[];
}> {
    const cutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const candidates = await db
        .select({
            key: feature_flags.key,
            enabled: feature_flags.enabled,
            rollout_pct: feature_flags.rollout_pct,
            last_toggled_at: feature_flags.last_toggled_at,
            owner: feature_flags.owner,
        })
        .from(feature_flags)
        .where(
            and(
                isNotNull(feature_flags.last_toggled_at),
                lte(feature_flags.last_toggled_at, cutoff),
                // stable end-state: enabled with rollout 100, or disabled
                sql`(${feature_flags.enabled} = false OR ${feature_flags.rollout_pct} >= 100)`
            )
        );

    for (const row of candidates) {
        logger.warn("feature-flags:cleanup_candidate", {
            key: row.key,
            owner: row.owner,
            enabled: row.enabled,
            rolloutPct: row.rollout_pct,
            lastToggledAt: row.last_toggled_at,
            recommendation:
                "Flag idle 60+ hari di state stable. Pertimbangkan cleanup PR (hapus if-checks + remove flag row).",
        });
    }

    void gte;

    return { flagged: candidates.map((r) => r.key) };
}
