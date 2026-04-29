import { createHash } from "crypto";
import { db } from "@/db";
import { feature_flags, feature_flag_kill_switch } from "@/db/schema";
import { invalidatePrefix } from "@/lib/cache";
import { logger } from "@/lib/logger";

export interface FeatureFlagAudience {
    roles?: string[];
    userIds?: string[];
    cohorts?: string[];
}

export interface FeatureFlagContext {
    userId?: string;
    role?: string;
    cohorts?: string[];
    bucketKey?: string;
}

type FeatureFlagRow = typeof feature_flags.$inferSelect;
type KillSwitchRow = typeof feature_flag_kill_switch.$inferSelect;

const CACHE_TTL_MS = 30_000;
const REDIS_PREFIX = "feature-flag:";

let flagCache: Map<string, FeatureFlagRow> | null = null;
let killSwitchCache: KillSwitchRow | null = null;
let cacheLoadedAt = 0;

function envOverrideFor(key: string): boolean | null {
    const envKey = `FEATURE_${key.toUpperCase().replace(/\./g, "_")}`;
    const raw = process.env[envKey];
    if (raw === "force-on") return true;
    if (raw === "force-off") return false;
    return null;
}

function matchesKillScope(key: string, scope: string | null | undefined): boolean {
    if (scope === "pdp-only") return key.startsWith("pdp.");
    if (scope === "differentiator-only") return key.startsWith("dif.");
    return key.startsWith("pdp.") || key.startsWith("dif.");
}

function passesAudience(flag: FeatureFlagRow, ctx: FeatureFlagContext): boolean | null {
    const audience = (flag.audience ?? {}) as FeatureFlagAudience;
    if (!audience.roles?.length && !audience.userIds?.length && !audience.cohorts?.length) {
        return null;
    }

    if (ctx.userId && audience.userIds?.includes(ctx.userId)) return true;
    if (ctx.role && audience.roles?.includes(ctx.role)) return true;
    if (ctx.cohorts?.some((cohort) => audience.cohorts?.includes(cohort))) return true;
    return false;
}

function pickRolloutBucket(key: string, bucketKey: string): number {
    const digest = createHash("sha256").update(`${key}:${bucketKey}`).digest();
    return digest[0] % 100;
}

async function ensureCacheLoaded(): Promise<void> {
    if (flagCache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
        return;
    }

    const [flags, killSwitch] = await Promise.all([
        db.select().from(feature_flags),
        db.select().from(feature_flag_kill_switch).limit(1),
    ]);

    flagCache = new Map(flags.map((flag) => [flag.key, flag]));
    killSwitchCache = killSwitch[0] ?? null;
    cacheLoadedAt = Date.now();
}

async function resolveFlag(key: string, ctx: FeatureFlagContext, seen: Set<string>): Promise<boolean> {
    const envOverride = envOverrideFor(key);
    if (envOverride !== null) {
        return envOverride;
    }

    await ensureCacheLoaded();

    if (killSwitchCache?.active && matchesKillScope(key, killSwitchCache.scope)) {
        return false;
    }

    const flag = flagCache?.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    const now = Date.now();
    if (flag.scheduled_enable_at && now < flag.scheduled_enable_at.getTime()) return false;
    if (flag.scheduled_disable_at && now >= flag.scheduled_disable_at.getTime()) return false;

    if (flag.parent_key) {
        if (seen.has(flag.parent_key)) {
            logger.warn("feature-flags:circular_dependency", { key, parentKey: flag.parent_key });
            return false;
        }
        seen.add(flag.parent_key);
        const parentEnabled = await resolveFlag(flag.parent_key, ctx, seen);
        if (!parentEnabled) return false;
    }

    const audienceResult = passesAudience(flag, ctx);
    if (audienceResult === true) return true;

    const rolloutPct = Number(flag.rollout_pct ?? 0);
    if (rolloutPct >= 100) return true;
    if (rolloutPct <= 0) return false;

    const bucketKey = ctx.bucketKey ?? ctx.userId;
    if (!bucketKey) return false;
    return pickRolloutBucket(key, bucketKey) < rolloutPct;
}

export async function isFeatureEnabled(key: string, ctx: FeatureFlagContext = {}): Promise<boolean> {
    return resolveFlag(key, ctx, new Set([key]));
}

export async function getFeatureFlagVariant(key: string, ctx: FeatureFlagContext = {}): Promise<string | null> {
    const flag = await getFeatureFlagDefinition(key);
    if (!flag?.variants) return null;
    const entries = Object.entries(flag.variants).filter(([, weight]) => Number(weight) > 0);
    if (entries.length === 0) return null;

    const bucketKey = ctx.bucketKey ?? ctx.userId;
    if (!bucketKey) return entries[0]?.[0] ?? null;

    const digest = createHash("sha256").update(`variant:${key}:${bucketKey}`).digest();
    const bucket = digest[1] % 100;
    let cursor = 0;
    for (const [variant, weight] of entries) {
        cursor += Number(weight);
        if (bucket < cursor) return variant;
    }
    return entries[entries.length - 1]?.[0] ?? null;
}

export async function getFeatureFlagDefinition(key: string): Promise<FeatureFlagRow | null> {
    await ensureCacheLoaded();
    return flagCache?.get(key) ?? null;
}

export async function listFeatureFlagDefinitions(): Promise<FeatureFlagRow[]> {
    await ensureCacheLoaded();
    return Array.from(flagCache?.values() ?? []).sort((left, right) => left.key.localeCompare(right.key));
}

export async function getFeatureKillSwitch(): Promise<KillSwitchRow | null> {
    await ensureCacheLoaded();
    return killSwitchCache;
}

export async function invalidateFeatureFlagCache(): Promise<void> {
    flagCache = null;
    killSwitchCache = null;
    cacheLoadedAt = 0;
    await invalidatePrefix(REDIS_PREFIX);
}