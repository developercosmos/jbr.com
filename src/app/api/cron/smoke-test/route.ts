import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
    disputes,
    feature_flag_audit_log,
    feature_flags,
    pdp_presence_pings,
    product_events,
} from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { listFeatureFlagDefinitions, getFeatureKillSwitch } from "@/lib/feature-flags";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * E2E smoke test cron entry.
 *
 * Hits critical-path public + admin URLs with anonymous fetch and runs
 * read-only DB probes for queries that have historically broken (drizzle
 * relational bombs, missing column references). Designed to surface
 * regressions in production within minutes of deploy, before users hit them.
 *
 * Schedule via system cron (recommended every 15 minutes):
 *   *​/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *     http://localhost:3000/api/cron/smoke-test \
 *     >> /var/www/jbr/logs/smoke-test.log 2>&1
 *
 * Returns 200 if all checks pass, 500 if any fail. Cron will surface
 * non-2xx via mail-on-error. Output is JSON:
 *   { ok: bool, durationMs, checks: [{ name, ok, status, error? }] }
 */

interface CheckResult {
    name: string;
    ok: boolean;
    status?: number;
    durationMs: number;
    error?: string;
    detail?: string;
}

function isAuthorized(request: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return false;
    const header = request.headers.get("authorization") || "";
    const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
    return provided === expected;
}

async function probeHttp(name: string, url: string, expectedStatuses: number[]): Promise<CheckResult> {
    const start = Date.now();
    try {
        const res = await fetch(url, {
            method: "GET",
            redirect: "manual",
            cache: "no-store",
            headers: { "user-agent": "JBR-smoke-test" },
        });
        const ok = expectedStatuses.includes(res.status);
        return {
            name,
            ok,
            status: res.status,
            durationMs: Date.now() - start,
            error: ok ? undefined : `expected ${expectedStatuses.join("|")}, got ${res.status}`,
        };
    } catch (error) {
        return {
            name,
            ok: false,
            durationMs: Date.now() - start,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function probeStaticAssets(originBase: string): Promise<CheckResult> {
    const start = Date.now();
    try {
        const res = await fetch(originBase, { cache: "no-store" });
        if (!res.ok) {
            return { name: "static-chunks", ok: false, status: res.status, durationMs: Date.now() - start, error: `homepage ${res.status}` };
        }
        const html = await res.text();
        const matches = Array.from(html.matchAll(/\/_next\/static\/chunks\/[^"'\s]+\.js/g));
        const chunkUrls = Array.from(new Set(matches.map((m) => m[0]))).slice(0, 5);
        if (chunkUrls.length === 0) {
            return { name: "static-chunks", ok: false, durationMs: Date.now() - start, error: "no chunk URLs found in HTML" };
        }
        const failures: string[] = [];
        for (const path of chunkUrls) {
            const chunkRes = await fetch(`${originBase}${path}`, { cache: "no-store" });
            if (chunkRes.status !== 200) {
                failures.push(`${path} → ${chunkRes.status}`);
                continue;
            }
            const ct = chunkRes.headers.get("content-type") ?? "";
            if (!ct.includes("javascript")) {
                failures.push(`${path} → wrong MIME ${ct}`);
            }
        }
        return {
            name: "static-chunks",
            ok: failures.length === 0,
            durationMs: Date.now() - start,
            detail: `tested ${chunkUrls.length} chunks`,
            error: failures.length > 0 ? failures.join("; ") : undefined,
        };
    } catch (error) {
        return {
            name: "static-chunks",
            ok: false,
            durationMs: Date.now() - start,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

async function probeDb<T>(name: string, fn: () => Promise<T>, validate?: (result: T) => string | null): Promise<CheckResult> {
    const start = Date.now();
    try {
        const result = await fn();
        const validationError = validate?.(result) ?? null;
        return {
            name,
            ok: !validationError,
            durationMs: Date.now() - start,
            error: validationError ?? undefined,
        };
    } catch (error) {
        return {
            name,
            ok: false,
            durationMs: Date.now() - start,
            error: error instanceof Error ? `${error.message} (${(error as Error & { code?: string }).code ?? "no-code"})` : String(error),
        };
    }
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return runChecks();
}

// Allow GET as well so simple `curl` cron-line works without --request POST.
export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return runChecks();
}

async function runChecks() {
    const start = Date.now();
    const origin = process.env.SMOKE_ORIGIN || "http://localhost:3000";

    const httpChecks: Promise<CheckResult>[] = [
        // Public — must render 200.
        probeHttp("home", `${origin}/`, [200]),
        probeHttp("search", `${origin}/search`, [200]),
        probeHttp("search?q", `${origin}/search?q=raket`, [200]),
        probeHttp("category-all", `${origin}/category/all`, [200]),
        probeHttp("login", `${origin}/auth/login`, [200]),
        probeHttp("register", `${origin}/auth/register`, [200]),

        // Admin — must redirect to login (307) but NOT 500.
        // 500 here means server-side rendering crashed (e.g., drizzle bomb).
        probeHttp("admin-feature-flags", `${origin}/admin/feature-flags`, [200, 307, 308]),
        probeHttp("admin-feature-flags-audit", `${origin}/admin/feature-flags/audit`, [200, 307, 308]),
        probeHttp("admin-feature-flags-kill-switch", `${origin}/admin/feature-flags/kill-switch`, [200, 307, 308]),
        probeHttp("admin-disputes", `${origin}/admin/disputes`, [200, 307, 308]),
        probeHttp("admin-disputes-buyer-rating", `${origin}/admin/disputes?subject=BUYER_RATING`, [200, 307, 308]),
        probeHttp("admin-orders", `${origin}/admin/orders`, [200, 307, 308]),
        probeHttp("admin-users", `${origin}/admin/users`, [200, 307, 308]),
        probeHttp("admin-files", `${origin}/admin/files`, [200, 307, 308]),
        probeHttp("admin-analytics", `${origin}/admin/analytics`, [200, 307, 308]),
        probeHttp("admin-kyc", `${origin}/admin/kyc`, [200, 307, 308]),
        probeHttp("admin-products", `${origin}/admin/products`, [200, 307, 308]),
        probeHttp("admin-categories", `${origin}/admin/categories`, [200, 307, 308]),
        probeHttp("admin-settings", `${origin}/admin/settings`, [200, 307, 308]),
        probeHttp("admin-moderation", `${origin}/admin/moderation`, [200, 307, 308]),
        probeHttp("admin-support", `${origin}/admin/support`, [200, 307, 308]),
        probeHttp("admin-fees", `${origin}/admin/fees`, [200, 307, 308]),
        probeHttp("admin-vouchers", `${origin}/admin/vouchers`, [200, 307, 308]),
        probeHttp("admin-affiliates", `${origin}/admin/affiliates`, [200, 307, 308]),
    ];

    const staticCheck = probeStaticAssets(origin);

    // Direct DB probes — covers query layers that the auth-gated admin pages
    // depend on. These would 500 in production if drizzle relations break or
    // a column is missing post-migration.
    const dbChecks: Promise<CheckResult>[] = [
        probeDb("db:feature_flags-list", () => listFeatureFlagDefinitions(), (rows) =>
            Array.isArray(rows) ? null : "non-array result"
        ),
        probeDb("db:feature_flags-kill-switch", () => getFeatureKillSwitch()),
        probeDb("db:feature_flag_audit_log-find", () =>
            db.query.feature_flag_audit_log.findMany({
                orderBy: [desc(feature_flag_audit_log.created_at)],
                limit: 1,
            })
        ),
        probeDb("db:feature_flags-count", () =>
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(feature_flags)
        ),
        probeDb("db:disputes-buyer-rating-filter", () =>
            db.query.disputes.findMany({
                where: eq(disputes.dispute_subject, "BUYER_RATING"),
                limit: 1,
            })
        ),
        probeDb("db:product_events-recent", () =>
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(product_events)
                .limit(1)
        ),
        probeDb("db:pdp_presence_pings-table", () =>
            db
                .select({ count: sql<number>`count(*)::int` })
                .from(pdp_presence_pings)
                .limit(1)
        ),
        // Sanity for offers.intent_score / scroll_depth_pct columns added in 0032.
        probeDb("db:offers-intent-columns", () =>
            db.execute(sql`SELECT intent_score, scroll_depth_pct FROM offers LIMIT 1`)
        ),
        // Sanity for confirmation_phrase column added in 0032.
        probeDb("db:audit-log-confirmation-column", () =>
            db.execute(sql`SELECT confirmation_phrase FROM feature_flag_audit_log LIMIT 1`)
        ),
    ];

    const [staticResult, ...rest] = await Promise.all([staticCheck, ...httpChecks, ...dbChecks]);
    const checks = [staticResult, ...rest];

    const failures = checks.filter((c) => !c.ok);
    const ok = failures.length === 0;
    const durationMs = Date.now() - start;

    if (!ok) {
        logger.error("smoke-test:fail", {
            failures: failures.map((f) => ({ name: f.name, status: f.status, error: f.error })),
            durationMs,
        });
    } else {
        logger.info("smoke-test:pass", { total: checks.length, durationMs });
    }

    return NextResponse.json(
        {
            ok,
            durationMs,
            total: checks.length,
            failed: failures.length,
            failures: failures.map((f) => ({ name: f.name, status: f.status, error: f.error })),
            checks,
            ranAt: new Date().toISOString(),
        },
        { status: ok ? 200 : 500 }
    );
}
