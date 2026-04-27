"use server";

import { db } from "@/db";
import { platform_fee_rules, platform_fee_rule_brackets, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, asc, desc, eq, isNull, lte, gt, gte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

async function requireAdmin() {
    const user = await getCurrentUser();
    const admin = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { id: true, role: true },
    });
    if (!admin || admin.role !== "ADMIN") {
        throw new Error("Admin access required");
    }
    return admin;
}

export interface FeeBreakdown {
    ruleId: string;
    ruleName: string;
    mode: "PERCENT" | "FIXED" | "TIERED";
    appliedBracket?: {
        minPrice: number;
        maxPrice: number | null;
        value: number;
        valueMode: "PERCENT" | "FIXED";
    };
    fee: number;
    formula: string;
}

export interface FeeResolution {
    fee: number;
    breakdown: FeeBreakdown | null;
    currency: string;
}

interface ResolveInput {
    price: number;
    categoryId?: string | null;
    sellerTier?: "T0" | "T1" | "T2";
    at?: Date;
}

/**
 * Pick the best-matching active fee rule and compute the fee.
 * Match precedence: priority DESC, then narrowest scope (category match wins
 * over null, tier match over null) — implemented via priority weighting.
 */
export async function calculatePlatformFee(input: ResolveInput): Promise<FeeResolution> {
    const at = input.at ?? new Date();
    const candidates = await db.query.platform_fee_rules.findMany({
        where: and(
            eq(platform_fee_rules.is_active, true),
            lte(platform_fee_rules.valid_from, at),
            or(isNull(platform_fee_rules.valid_to), gt(platform_fee_rules.valid_to, at))
        ),
        orderBy: [desc(platform_fee_rules.priority), desc(platform_fee_rules.created_at)],
        with: {
            brackets: {
                orderBy: [asc(platform_fee_rule_brackets.min_price)],
            },
        },
    });

    const tier = input.sellerTier ?? "T0";

    const matched = candidates.find((rule) => {
        if (rule.scope_category_id && rule.scope_category_id !== input.categoryId) return false;
        if (rule.scope_seller_tier && rule.scope_seller_tier !== tier) return false;
        return true;
    });

    if (!matched) {
        return { fee: 0, breakdown: null, currency: "IDR" };
    }

    const price = input.price;
    let fee = 0;
    let breakdown: FeeBreakdown;

    if (matched.mode === "FIXED") {
        fee = Number(matched.default_value);
        breakdown = {
            ruleId: matched.id,
            ruleName: matched.name,
            mode: "FIXED",
            fee,
            formula: `Fixed ${fee.toLocaleString("id-ID")} per item`,
        };
    } else if (matched.mode === "PERCENT") {
        const pct = Number(matched.default_value);
        fee = (price * pct) / 100;
        breakdown = {
            ruleId: matched.id,
            ruleName: matched.name,
            mode: "PERCENT",
            fee,
            formula: `${pct}% × ${price.toLocaleString("id-ID")}`,
        };
    } else {
        // TIERED
        const bracket = matched.brackets.find((b) => {
            const min = Number(b.min_price);
            const max = b.max_price === null ? Infinity : Number(b.max_price);
            return price >= min && price < max;
        });
        if (!bracket) {
            const fallback = Number(matched.default_value);
            fee = matched.mode === "TIERED" ? (price * fallback) / 100 : fallback;
            breakdown = {
                ruleId: matched.id,
                ruleName: matched.name,
                mode: "TIERED",
                fee,
                formula: `Fallback default ${fallback}`,
            };
        } else {
            const value = Number(bracket.value);
            fee = bracket.value_mode === "PERCENT" ? (price * value) / 100 : value;
            breakdown = {
                ruleId: matched.id,
                ruleName: matched.name,
                mode: "TIERED",
                appliedBracket: {
                    minPrice: Number(bracket.min_price),
                    maxPrice: bracket.max_price === null ? null : Number(bracket.max_price),
                    value,
                    valueMode: bracket.value_mode,
                },
                fee,
                formula:
                    bracket.value_mode === "PERCENT"
                        ? `${value}% × ${price.toLocaleString("id-ID")} (bracket)`
                        : `Flat ${value.toLocaleString("id-ID")} (bracket)`,
            };
        }
    }

    return {
        fee: Math.round(fee),
        breakdown,
        currency: "IDR",
    };
}

const createFeeRuleSchema = z.object({
    name: z.string().min(2).max(120),
    scope_category_id: z.string().uuid().nullable().optional(),
    scope_seller_tier: z.enum(["T0", "T1", "T2"]).nullable().optional(),
    valid_from: z.string().datetime().optional(),
    valid_to: z.string().datetime().nullable().optional(),
    priority: z.number().int().min(0).max(10000).default(100),
    is_active: z.boolean().default(true),
    mode: z.enum(["PERCENT", "FIXED", "TIERED"]),
    default_value: z.number().min(0),
    brackets: z
        .array(
            z.object({
                min_price: z.number().min(0),
                max_price: z.number().min(0).nullable().optional(),
                value: z.number().min(0),
                value_mode: z.enum(["PERCENT", "FIXED"]),
            })
        )
        .optional(),
});

export async function createFeeRule(input: z.infer<typeof createFeeRuleSchema>) {
    await requireAdmin();
    const validated = createFeeRuleSchema.parse(input);

    const [rule] = await db
        .insert(platform_fee_rules)
        .values({
            name: validated.name,
            scope_category_id: validated.scope_category_id ?? null,
            scope_seller_tier: validated.scope_seller_tier ?? null,
            valid_from: validated.valid_from ? new Date(validated.valid_from) : new Date(),
            valid_to: validated.valid_to ? new Date(validated.valid_to) : null,
            priority: validated.priority,
            is_active: validated.is_active,
            mode: validated.mode,
            default_value: String(validated.default_value),
        })
        .returning();

    if (validated.mode === "TIERED" && validated.brackets && validated.brackets.length > 0) {
        await db.insert(platform_fee_rule_brackets).values(
            validated.brackets.map((b) => ({
                rule_id: rule.id,
                min_price: String(b.min_price),
                max_price: b.max_price !== null && b.max_price !== undefined ? String(b.max_price) : null,
                value: String(b.value),
                value_mode: b.value_mode,
            }))
        );
    }

    revalidatePath("/admin/fees");
    return { success: true, ruleId: rule.id };
}

export async function archiveFeeRule(ruleId: string) {
    await requireAdmin();
    await db
        .update(platform_fee_rules)
        .set({ is_active: false, updated_at: new Date() })
        .where(eq(platform_fee_rules.id, ruleId));
    revalidatePath("/admin/fees");
    return { success: true };
}

export async function listFeeRules() {
    await requireAdmin();
    return db.query.platform_fee_rules.findMany({
        orderBy: [desc(platform_fee_rules.priority), desc(platform_fee_rules.created_at)],
        with: {
            brackets: {
                orderBy: [asc(platform_fee_rule_brackets.min_price)],
            },
        },
    });
}

const simulateSchema = z.object({
    price: z.number().min(0),
    categoryId: z.string().uuid().nullable().optional(),
    sellerTier: z.enum(["T0", "T1", "T2"]).optional(),
});

export async function simulateFee(input: z.infer<typeof simulateSchema>) {
    await requireAdmin();
    const validated = simulateSchema.parse(input);
    return calculatePlatformFee({
        price: validated.price,
        categoryId: validated.categoryId ?? null,
        sellerTier: validated.sellerTier,
    });
}

// Suppress unused-import warnings for symbols reserved for follow-up tooling.
void gte;
void sql;
