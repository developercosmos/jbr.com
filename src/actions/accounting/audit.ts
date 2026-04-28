"use server";

/**
 * GL — Finance audit log helper (Phase 10).
 *
 * Records every privileged finance write into accounting_audit_log.
 * Best-effort: failures NEVER throw to caller (we log to console only).
 *
 * Audit actions used (canonical list):
 *   SETTING_UPDATE
 *   PERIOD_LOCK / PERIOD_CLOSE / PERIOD_REOPEN
 *   JOURNAL_MANUAL_POST
 *   INVENTORY_RECEIPT / INVENTORY_COGS / INVENTORY_ADJUSTMENT
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";

export interface FinanceAuditInput {
    action: string;
    actorId?: string | null;
    actorEmail?: string | null;
    targetType?: string;
    targetId?: string;
    payload?: unknown;
}

export async function recordFinanceAudit(input: FinanceAuditInput): Promise<void> {
    try {
        let ip: string | null = null;
        let ua: string | null = null;
        try {
            const h = await headers();
            ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
            ua = h.get("user-agent") ?? null;
        } catch {
            // Outside request scope (e.g. cron job) — leave null.
        }
        await db.execute(sql`
            INSERT INTO accounting_audit_log
                (action, actor_id, actor_email, target_type, target_id, payload, ip, user_agent)
            VALUES
                (${input.action},
                 ${input.actorId ?? null},
                 ${input.actorEmail ?? null},
                 ${input.targetType ?? null},
                 ${input.targetId ?? null},
                 ${input.payload ? JSON.stringify(input.payload) : null}::jsonb,
                 ${ip},
                 ${ua})
        `);
    } catch (e) {
        console.error("[recordFinanceAudit] failed:", e instanceof Error ? e.message : String(e));
    }
}

export interface FinanceAuditEntry {
    id: string;
    action: string;
    actorId: string | null;
    actorEmail: string | null;
    targetType: string | null;
    targetId: string | null;
    payload: unknown;
    ip: string | null;
    userAgent: string | null;
    occurredAt: string;
}

export async function listFinanceAudit(opts: {
    limit?: number;
    action?: string;
    actorId?: string;
} = {}): Promise<FinanceAuditEntry[]> {
    const limit = Math.min(opts.limit ?? 200, 500);
    const where: ReturnType<typeof sql>[] = [];
    if (opts.action) where.push(sql`a.action = ${opts.action}`);
    if (opts.actorId) where.push(sql`a.actor_id = ${opts.actorId}`);
    const whereSql = where.length ? sql`WHERE ${sql.join(where, sql` AND `)}` : sql``;
    const rows = await db.execute(sql`
        SELECT a.id, a.action, a.actor_id, a.actor_email,
               a.target_type, a.target_id, a.payload, a.ip, a.user_agent,
               a.occurred_at
        FROM accounting_audit_log a
        ${whereSql}
        ORDER BY a.occurred_at DESC
        LIMIT ${limit}
    `);
    type R = {
        id: string;
        action: string;
        actor_id: string | null;
        actor_email: string | null;
        target_type: string | null;
        target_id: string | null;
        payload: unknown;
        ip: string | null;
        user_agent: string | null;
        occurred_at: string | Date;
    };
    return (rows as unknown as R[]).map((r) => ({
        id: String(r.id),
        action: r.action,
        actorId: r.actor_id,
        actorEmail: r.actor_email,
        targetType: r.target_type,
        targetId: r.target_id,
        payload: r.payload,
        ip: r.ip,
        userAgent: r.user_agent,
        occurredAt: new Date(r.occurred_at as string | Date).toISOString(),
    }));
}
