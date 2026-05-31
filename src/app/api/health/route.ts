import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { pingRedis } from "@/lib/queue";

export const dynamic = "force-dynamic";

// Liveness + dependency health. Probes Postgres (required) and Redis (best-effort:
// Redis backs queues/cache, so an outage degrades but doesn't down the app).
// Returns 503 when the database is unreachable so the load balancer / PM2
// healthcheck can pull the instance out of rotation.
export async function GET() {
    const startedAt = Date.now();

    let dbOk = false;
    let dbLatencyMs: number | null = null;
    try {
        await db.execute(sql`SELECT 1`);
        dbLatencyMs = Date.now() - startedAt;
        dbOk = true;
    } catch {
        dbOk = false;
    }

    const redis = await pingRedis();

    return NextResponse.json(
        {
            status: dbOk ? "ok" : "error",
            db: dbOk ? "connected" : "disconnected",
            dbLatencyMs,
            redis,
            timestamp: new Date().toISOString(),
        },
        { status: dbOk ? 200 : 503 }
    );
}
