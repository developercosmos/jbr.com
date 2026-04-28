"use server";

import { db } from "@/db";
import {
    affiliate_accounts,
    affiliate_attributions,
    affiliate_clicks,
    orders,
    users,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers, cookies } from "next/headers";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    postAffiliateCommissionAccrual,
    postAffiliateCommissionReverse,
    postAffiliatePayment,
} from "@/actions/accounting/posting";
import { getSetting } from "@/actions/accounting/settings";
import { logger } from "@/lib/logger";

const ATTRIBUTION_WINDOW_DAYS = Number(process.env.AFFILIATE_ATTRIBUTION_DAYS || 30);
const DEFAULT_COMMISSION_RATE = Number(process.env.AFFILIATE_DEFAULT_RATE || 5);
const AFFILIATE_COOKIE = "jbr_aff";
const RESERVED_CODES = new Set(["admin", "api", "seller", "buyer", "support", "auth"]);

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

async function requireAdmin() {
    const user = await getCurrentUser();
    const admin = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, role: true },
    });
    if (!admin || admin.role !== "ADMIN") throw new Error("Admin access required");
    return admin;
}

function generateCodeFromName(name: string): string {
    const base = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 8);
    const suffix = Math.random().toString(36).slice(2, 6);
    const candidate = `${base || "aff"}${suffix}`;
    return RESERVED_CODES.has(candidate) ? `${candidate}1` : candidate;
}

const enrollSchema = z.object({
    payoutMethod: z.string().max(40).optional(),
    payoutAccount: z.string().max(120).optional(),
});

export async function enrollAffiliate(input: z.infer<typeof enrollSchema>) {
    const user = await getCurrentUser();
    const validated = enrollSchema.parse(input);

    const existing = await db.query.affiliate_accounts.findFirst({
        where: eq(affiliate_accounts.user_id, user.id),
    });
    if (existing) {
        return { success: true, code: existing.code, alreadyEnrolled: true };
    }

    let code = generateCodeFromName(user.name || "aff");
    for (let i = 0; i < 5; i++) {
        const conflict = await db.query.affiliate_accounts.findFirst({
            where: eq(affiliate_accounts.code, code),
            columns: { user_id: true },
        });
        if (!conflict) break;
        code = generateCodeFromName(`${user.name || "aff"}${i}`);
    }

    const [created] = await db
        .insert(affiliate_accounts)
        .values({
            user_id: user.id,
            code,
            status: "ACTIVE",
            payout_method: validated.payoutMethod,
            payout_account: validated.payoutAccount,
        })
        .returning();

    revalidatePath("/affiliate");
    return { success: true, code: created.code };
}

export async function recordAffiliateClick(opts: {
    code: string;
    referrer?: string;
    landingUrl?: string;
    ip?: string;
    userAgent?: string;
}) {
    const account = await db.query.affiliate_accounts.findFirst({
        where: and(eq(affiliate_accounts.code, opts.code), eq(affiliate_accounts.status, "ACTIVE")),
        columns: { user_id: true },
    });
    if (!account) return { success: false, reason: "code_not_active" };

    const expires = new Date(Date.now() + ATTRIBUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    await db.insert(affiliate_clicks).values({
        code: opts.code,
        referrer: opts.referrer,
        landing_url: opts.landingUrl,
        ip: opts.ip,
        user_agent: opts.userAgent,
        expires_at: expires,
    });

    return { success: true };
}

/**
 * Hooked into createOrderFromCart: read affiliate cookie and create a PENDING
 * attribution row (status flips to CLEARED on order completion via cron sweep).
 * Self-purchase blocked by checking buyer is not the affiliate owner.
 */
export async function tryAttributeOrderFromCookie(orderId: string, buyerId: string, orderTotal: number) {
    const cookieStore = await cookies();
    const code = cookieStore.get(AFFILIATE_COOKIE)?.value;
    if (!code) return { attributed: false, reason: "no_cookie" };

    const account = await db.query.affiliate_accounts.findFirst({
        where: and(eq(affiliate_accounts.code, code), eq(affiliate_accounts.status, "ACTIVE")),
        columns: { user_id: true, commission_rate_override: true },
    });
    if (!account) return { attributed: false, reason: "code_not_active" };
    if (account.user_id === buyerId) return { attributed: false, reason: "self_purchase" };

    const ratePercent = Number(account.commission_rate_override ?? DEFAULT_COMMISSION_RATE);
    const commission = Math.round((orderTotal * ratePercent) / 100);

    await db
        .insert(affiliate_attributions)
        .values({
            order_id: orderId,
            affiliate_user_id: account.user_id,
            code,
            computed_commission: String(commission),
            rate_used: String(ratePercent),
            status: "PENDING",
        })
        .onConflictDoNothing();

    return { attributed: true, commission, rate: ratePercent };
}

/**
 * Cron-driven: clear attributions whose order has reached COMPLETED.
 */
export async function clearAttributionsForCompletedOrders() {
    const pending = await db
        .select({
            id: affiliate_attributions.id,
            orderId: affiliate_attributions.order_id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
        })
        .from(affiliate_attributions)
        .innerJoin(orders, eq(orders.id, affiliate_attributions.order_id))
        .where(and(eq(affiliate_attributions.status, "PENDING"), eq(orders.status, "COMPLETED")));

    let cleared = 0;
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    for (const row of pending) {
        const updated = await db
            .update(affiliate_attributions)
            .set({ status: "CLEARED", decided_at: new Date() })
            .where(and(eq(affiliate_attributions.id, row.id), eq(affiliate_attributions.status, "PENDING")))
            .returning({ id: affiliate_attributions.id });
        if (updated[0]) {
            cleared++;
            // GL-12: accrue commission expense once attribution is CLEARED.
            if (dualWrite) {
                const amount = Number(row.commission || 0);
                if (amount > 0) {
                    try {
                        await postAffiliateCommissionAccrual({
                            attributionId: row.id,
                            affiliateUserId: row.affiliateUserId,
                            orderId: row.orderId,
                            commission: amount,
                        });
                    } catch (glError) {
                        logger.error("gl:post_affiliate_accrual_failed", {
                            attributionId: row.id,
                            error: String(glError),
                        });
                    }
                }
            }
        }
    }

    return { inspected: pending.length, cleared };
}

export async function reverseAttributionForRefund(orderId: string, memo?: string) {
    const rows = await db
        .select({
            id: affiliate_attributions.id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
            status: affiliate_attributions.status,
        })
        .from(affiliate_attributions)
        .where(eq(affiliate_attributions.order_id, orderId));

    await db
        .update(affiliate_attributions)
        .set({ status: "REVERSED", decided_at: new Date(), memo })
        .where(eq(affiliate_attributions.order_id, orderId));

    // GL-12: reverse only rows that had been CLEARED (i.e., already accrued).
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        for (const row of rows) {
            if (row.status !== "CLEARED") continue;
            const amount = Number(row.commission || 0);
            if (amount <= 0) continue;
            try {
                await postAffiliateCommissionReverse({
                    attributionId: row.id,
                    affiliateUserId: row.affiliateUserId,
                    commission: amount,
                });
            } catch (glError) {
                logger.error("gl:post_affiliate_reverse_failed", {
                    attributionId: row.id,
                    error: String(glError),
                });
            }
        }
    }
}

export async function getAffiliateDashboard() {
    const user = await getCurrentUser();
    const account = await db.query.affiliate_accounts.findFirst({
        where: eq(affiliate_accounts.user_id, user.id),
    });

    if (!account) {
        return {
            account: null as null | {
                code: string;
                status: string;
                payoutMethod: string | null;
                payoutAccount: string | null;
            },
            totals: { clicks: 0, conversions: 0, pending: 0, cleared: 0, reversed: 0 },
            attributions: [] as Array<{
                id: string;
                orderId: string;
                commission: number;
                rate: number;
                status: string;
                createdAt: string;
            }>,
        };
    }

    const [clickCount] = await db
        .select({ value: sql<number>`count(*)` })
        .from(affiliate_clicks)
        .where(eq(affiliate_clicks.code, account.code));

    const aggregates = await db
        .select({
            status: affiliate_attributions.status,
            count: sql<number>`count(*)`,
            commission: sql<string>`coalesce(sum(${affiliate_attributions.computed_commission}), 0)`,
        })
        .from(affiliate_attributions)
        .where(eq(affiliate_attributions.affiliate_user_id, user.id))
        .groupBy(affiliate_attributions.status);

    const totals = aggregates.reduce(
        (acc, row) => {
            const count = Number(row.count);
            const commission = Number(row.commission);
            acc.conversions += count;
            if (row.status === "PENDING") acc.pending += commission;
            if (row.status === "CLEARED") acc.cleared += commission;
            if (row.status === "REVERSED") acc.reversed += commission;
            return acc;
        },
        { clicks: Number(clickCount?.value ?? 0), conversions: 0, pending: 0, cleared: 0, reversed: 0 }
    );

    const recent = await db.query.affiliate_attributions.findMany({
        where: eq(affiliate_attributions.affiliate_user_id, user.id),
        orderBy: [desc(affiliate_attributions.created_at)],
        limit: 50,
    });

    return {
        account: {
            code: account.code,
            status: account.status,
            payoutMethod: account.payout_method,
            payoutAccount: account.payout_account,
        },
        totals,
        attributions: recent.map((a) => ({
            id: a.id,
            orderId: a.order_id,
            commission: Number(a.computed_commission),
            rate: Number(a.rate_used),
            status: a.status,
            createdAt: a.created_at.toISOString(),
        })),
    };
}

export async function listAffiliatesForAdmin() {
    await requireAdmin();
    return db.query.affiliate_accounts.findMany({
        orderBy: [desc(affiliate_accounts.created_at)],
        with: {
            user: { columns: { id: true, name: true, email: true } },
        },
    });
}

const overrideRateSchema = z.object({
    affiliateUserId: z.string(),
    rate: z.number().min(0).max(100).nullable(),
});

export async function setAffiliateRateOverride(input: z.infer<typeof overrideRateSchema>) {
    await requireAdmin();
    const validated = overrideRateSchema.parse(input);
    await db
        .update(affiliate_accounts)
        .set({
            commission_rate_override: validated.rate === null ? null : String(validated.rate),
            updated_at: new Date(),
        })
        .where(eq(affiliate_accounts.user_id, validated.affiliateUserId));
    revalidatePath("/admin/affiliates");
    return { success: true };
}

export async function suspendAffiliate(affiliateUserId: string) {
    await requireAdmin();
    await db
        .update(affiliate_accounts)
        .set({ status: "SUSPENDED", updated_at: new Date() })
        .where(eq(affiliate_accounts.user_id, affiliateUserId));
    revalidatePath("/admin/affiliates");
    return { success: true };
}

export async function processAffiliatePayoutBatch() {
    await requireAdmin();

    const cleared = await db
        .select({
            id: affiliate_attributions.id,
            affiliateUserId: affiliate_attributions.affiliate_user_id,
            commission: affiliate_attributions.computed_commission,
            orderId: affiliate_attributions.order_id,
        })
        .from(affiliate_attributions)
        .where(eq(affiliate_attributions.status, "CLEARED"));

    if (cleared.length === 0) {
        return { processed: 0, totalAmount: 0, lines: [] };
    }

    // Aggregate per affiliate for the batch summary; mark each row paid via memo.
    const totals = new Map<string, number>();
    for (const row of cleared) {
        totals.set(row.affiliateUserId, (totals.get(row.affiliateUserId) ?? 0) + Number(row.commission));
    }

    const stamp = new Date().toISOString();
    await db
        .update(affiliate_attributions)
        .set({ memo: sql`coalesce(${affiliate_attributions.memo}, '') || ' [paid:' || ${stamp} || ']'` })
        .where(eq(affiliate_attributions.status, "CLEARED"));

    const lines = Array.from(totals.entries()).map(([affiliateUserId, amount]) => ({
        affiliateUserId,
        amount,
    }));

    // GL-12: post the cash-out leg per affiliate. Use a per-batch idempotency
    // suffix from the stamp so retries within the same batch are deduped.
    const dualWrite = await getSetting<boolean>("gl.dual_write_legacy", { defaultValue: true });
    if (dualWrite) {
        for (const line of lines) {
            if (line.amount <= 0) continue;
            try {
                await postAffiliatePayment({
                    payoutId: `${stamp}:${line.affiliateUserId}`,
                    affiliateUserId: line.affiliateUserId,
                    grossCommission: line.amount,
                });
            } catch (glError) {
                logger.error("gl:post_affiliate_payment_failed", {
                    affiliateUserId: line.affiliateUserId,
                    error: String(glError),
                });
            }
        }
    }

    return {
        processed: cleared.length,
        totalAmount: lines.reduce((sum, l) => sum + l.amount, 0),
        lines,
    };
}
