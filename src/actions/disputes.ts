"use server";

import { db } from "@/db";
import { disputes } from "@/db/schema";
import { and, eq, isNotNull, lte, sql } from "drizzle-orm";

const RESPONSE_HOURS = Number(process.env.DISPUTE_RESPONSE_HOURS || 24);
const RESOLUTION_HOURS = Number(process.env.DISPUTE_RESOLUTION_HOURS || 24 * 7);

function addHours(base: Date, hours: number) {
    return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function computeDisputeSla(createdAt: Date = new Date()) {
    return {
        responseDueAt: addHours(createdAt, RESPONSE_HOURS),
        resolutionDueAt: addHours(createdAt, RESOLUTION_HOURS),
    };
}

export interface DisputeSlaSweepResult {
    inspected: number;
    escalated: number;
    escalatedDisputeIds: string[];
}

export async function runDisputeSlaSweep(): Promise<DisputeSlaSweepResult> {
    const now = new Date();

    const breached = await db
        .select({ id: disputes.id })
        .from(disputes)
        .where(
            and(
                isNotNull(disputes.response_due_at),
                lte(disputes.response_due_at, now),
                sql`${disputes.status} IN ('OPEN', 'AWAITING_RESPONSE')`
            )
        );

    if (breached.length === 0) {
        return { inspected: 0, escalated: 0, escalatedDisputeIds: [] };
    }

    const escalatedIds: string[] = [];

    for (const row of breached) {
        const updated = await db
            .update(disputes)
            .set({
                status: "IN_PROGRESS",
                priority: "HIGH",
                escalation_count: sql`${disputes.escalation_count} + 1`,
                updated_at: new Date(),
            })
            .where(eq(disputes.id, row.id))
            .returning({ id: disputes.id });
        if (updated[0]) {
            escalatedIds.push(updated[0].id);
        }
    }

    return {
        inspected: breached.length,
        escalated: escalatedIds.length,
        escalatedDisputeIds: escalatedIds,
    };
}
