"use server";

import { db } from "@/db";
import { accounting_settings } from "@/db/schema";
import { and, desc, eq, isNull, or, sql, gt } from "drizzle-orm";

/**
 * Settings service (GL-09)
 *
 * Resolves versioned key/value configuration with effective_from/effective_to.
 * Backed by accounting_settings table seeded in 0019_accounting_general_ledger.sql.
 *
 * - Resolution: scope match → is_active → effective_from <= at < (effective_to ?? +inf)
 *   → highest effective_from wins.
 * - Cache: in-memory per process, 60s TTL (or invalidated by setSetting()).
 *   On serverless this is per-instance; for true cross-instance invalidation
 *   add Redis pub/sub (deferred to Phase 3).
 */

type Json =
    | string
    | number
    | boolean
    | null
    | Json[]
    | { [k: string]: Json };

interface CacheEntry {
    value: Json;
    expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

function cacheKey(key: string, scope: string, atIso: string): string {
    return `${key}::${scope}::${atIso}`;
}

export async function getSetting<T = Json>(
    key: string,
    opts?: { scope?: string; at?: Date; defaultValue?: T }
): Promise<T | null> {
    const scope = opts?.scope ?? "GLOBAL";
    const at = opts?.at ?? new Date();
    const atIso = at.toISOString().slice(0, 10); // date-precision is enough for versioning
    const ck = cacheKey(key, scope, atIso);

    const cached = CACHE.get(ck);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.value as T;
    }

    const rows = await db
        .select({ value: accounting_settings.value })
        .from(accounting_settings)
        .where(
            and(
                eq(accounting_settings.key, key),
                eq(accounting_settings.scope, scope),
                eq(accounting_settings.is_active, true),
                sql`${accounting_settings.effective_from} <= ${atIso}::date`,
                or(
                    isNull(accounting_settings.effective_to),
                    gt(accounting_settings.effective_to, atIso)
                )
            )
        )
        .orderBy(desc(accounting_settings.effective_from))
        .limit(1);

    let value: Json | null = null;
    if (rows[0]) {
        value = rows[0].value as Json;
    } else if (opts?.defaultValue !== undefined) {
        value = opts.defaultValue as unknown as Json;
    }

    CACHE.set(ck, { value: value as Json, expiresAt: Date.now() + CACHE_TTL_MS });
    return value as T | null;
}

/**
 * setSetting — versioned write. Writes a new row with effective_from (default today).
 * Does NOT overwrite the previous value, preserving historical reproducibility.
 *
 * If a row with same key+scope+effective_from already exists, it is updated in-place
 * (so re-saving "today's value" doesn't pile up duplicates).
 */
export async function setSetting(
    key: string,
    value: Json,
    opts?: { scope?: string; effectiveFrom?: Date; updatedBy?: string; notes?: string }
): Promise<{ id: string }> {
    const scope = opts?.scope ?? "GLOBAL";
    const effectiveFrom = opts?.effectiveFrom ?? new Date();
    const eff = effectiveFrom.toISOString().slice(0, 10);

    // Look for an existing row for this exact (key, scope, effective_from)
    const existing = await db
        .select({ id: accounting_settings.id })
        .from(accounting_settings)
        .where(
            and(
                eq(accounting_settings.key, key),
                eq(accounting_settings.scope, scope),
                sql`${accounting_settings.effective_from} = ${eff}::date`
            )
        )
        .limit(1);

    let id: string;
    if (existing[0]) {
        await db
            .update(accounting_settings)
            .set({
                value: value as never,
                is_active: true,
                notes: opts?.notes ?? null,
                updated_by: opts?.updatedBy ?? null,
                updated_at: new Date(),
            })
            .where(eq(accounting_settings.id, existing[0].id));
        id = existing[0].id;
    } else {
        const [row] = await db
            .insert(accounting_settings)
            .values({
                key,
                value: value as never,
                scope,
                effective_from: eff,
                is_active: true,
                notes: opts?.notes ?? null,
                updated_by: opts?.updatedBy ?? null,
            })
            .returning({ id: accounting_settings.id });
        id = row.id;
    }

    // Invalidate all cache entries for this key/scope (cheap because keyed by key prefix).
    for (const k of Array.from(CACHE.keys())) {
        if (k.startsWith(`${key}::${scope}::`)) CACHE.delete(k);
    }

    return { id };
}

/**
 * getSettingHistory — list all versions of a key (including inactive) sorted by effective_from desc.
 */
export async function getSettingHistory(key: string, scope: string = "GLOBAL") {
    return db
        .select()
        .from(accounting_settings)
        .where(
            and(eq(accounting_settings.key, key), eq(accounting_settings.scope, scope))
        )
        .orderBy(desc(accounting_settings.effective_from), desc(accounting_settings.created_at));
}

/**
 * listSettings — current effective values across all keys for a scope (for Settings UI).
 */
export async function listSettings(scope: string = "GLOBAL", at: Date = new Date()) {
    const atIso = at.toISOString().slice(0, 10);
    const rows = await db.execute<{
        key: string;
        value: Json;
        effective_from: string;
        effective_to: string | null;
        notes: string | null;
        updated_at: Date;
    }>(sql`
        SELECT DISTINCT ON (key)
            key, value, effective_from, effective_to, notes, updated_at
        FROM accounting_settings
        WHERE scope = ${scope}
          AND is_active = true
          AND effective_from <= ${atIso}::date
          AND (effective_to IS NULL OR effective_to > ${atIso}::date)
        ORDER BY key, effective_from DESC
    `);
    return rows;
}

/**
 * Test-only: clear in-memory cache. Exported via a separate path in tests.
 */
export async function _clearSettingsCache(): Promise<void> {
    CACHE.clear();
}
