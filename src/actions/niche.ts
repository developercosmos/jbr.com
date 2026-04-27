"use server";

import { db } from "@/db";
import { player_profiles, products, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) throw new Error("Unauthorized");
    return session.user;
}

const WEIGHT_CLASSES = ["2U", "3U", "4U", "5U", "6U"] as const;
const BALANCES = ["HEAD_HEAVY", "EVEN", "HEAD_LIGHT"] as const;
const SHAFT_FLEXES = ["STIFF", "MEDIUM", "FLEXIBLE"] as const;
const GRIP_SIZES = ["G2", "G3", "G4", "G5", "G6"] as const;
const PLAYER_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"] as const;
const PLAY_STYLES = ["OFFENSIVE", "DEFENSIVE", "ALL_AROUND", "DOUBLES_FRONT", "DOUBLES_BACK"] as const;

const specSearchSchema = z.object({
    weight_class: z.array(z.enum(WEIGHT_CLASSES)).optional(),
    balance: z.array(z.enum(BALANCES)).optional(),
    shaft_flex: z.array(z.enum(SHAFT_FLEXES)).optional(),
    grip_size: z.array(z.enum(GRIP_SIZES)).optional(),
    min_tension_lbs: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(100).default(24),
    offset: z.number().int().min(0).default(0),
});

export async function searchBySpecs(input: z.infer<typeof specSearchSchema>) {
    const validated = specSearchSchema.parse(input);
    const conditions = [eq(products.status, "PUBLISHED")];

    if (validated.weight_class && validated.weight_class.length > 0) {
        conditions.push(inArray(products.weight_class, validated.weight_class));
    }
    if (validated.balance && validated.balance.length > 0) {
        conditions.push(inArray(products.balance, validated.balance));
    }
    if (validated.shaft_flex && validated.shaft_flex.length > 0) {
        conditions.push(inArray(products.shaft_flex, validated.shaft_flex));
    }
    if (validated.grip_size && validated.grip_size.length > 0) {
        conditions.push(inArray(products.grip_size, validated.grip_size));
    }
    if (validated.min_tension_lbs !== undefined) {
        conditions.push(gte(products.max_string_tension_lbs, validated.min_tension_lbs));
    }

    return db.query.products.findMany({
        where: and(...conditions),
        limit: validated.limit,
        offset: validated.offset,
        columns: {
            id: true,
            title: true,
            slug: true,
            price: true,
            images: true,
            weight_class: true,
            balance: true,
            shaft_flex: true,
            grip_size: true,
            max_string_tension_lbs: true,
            stiffness_rating: true,
        },
    });
}

export async function getCompareSet(slugs: string[]) {
    if (slugs.length === 0) return [];
    const limited = slugs.slice(0, 3);
    return db.query.products.findMany({
        where: and(eq(products.status, "PUBLISHED"), inArray(products.slug, limited)),
        with: {
            seller: { columns: { id: true, name: true, store_name: true, store_slug: true } },
        },
        columns: {
            id: true,
            title: true,
            slug: true,
            price: true,
            images: true,
            condition: true,
            condition_rating: true,
            weight_class: true,
            balance: true,
            shaft_flex: true,
            grip_size: true,
            max_string_tension_lbs: true,
            stiffness_rating: true,
        },
    });
}

const upsertProfileSchema = z.object({
    level: z.enum(PLAYER_LEVELS).optional(),
    play_style: z.enum(PLAY_STYLES).optional(),
    dominant_hand: z.enum(["LEFT", "RIGHT", "AMBI"]).optional(),
    preferred_weight_class: z.enum(WEIGHT_CLASSES).optional(),
    preferred_balance: z.enum(BALANCES).optional(),
    preferred_shaft_flex: z.enum(SHAFT_FLEXES).optional(),
});

export async function upsertPlayerProfile(input: z.infer<typeof upsertProfileSchema>) {
    const user = await getCurrentUser();
    const validated = upsertProfileSchema.parse(input);

    await db
        .insert(player_profiles)
        .values({
            user_id: user.id,
            level: validated.level,
            play_style: validated.play_style,
            dominant_hand: validated.dominant_hand,
            preferred_weight_class: validated.preferred_weight_class,
            preferred_balance: validated.preferred_balance,
            preferred_shaft_flex: validated.preferred_shaft_flex,
            updated_at: new Date(),
        })
        .onConflictDoUpdate({
            target: player_profiles.user_id,
            set: {
                level: validated.level,
                play_style: validated.play_style,
                dominant_hand: validated.dominant_hand,
                preferred_weight_class: validated.preferred_weight_class,
                preferred_balance: validated.preferred_balance,
                preferred_shaft_flex: validated.preferred_shaft_flex,
                updated_at: new Date(),
            },
        });

    revalidatePath("/profile/player");
    revalidatePath("/");
    return { success: true };
}

export async function getPlayerProfile(userId?: string) {
    const targetId = userId ?? (await getCurrentUser()).id;
    return db.query.player_profiles.findFirst({
        where: eq(player_profiles.user_id, targetId),
    });
}

/**
 * Rule-based recommender: derive preferred specs from level + style, then
 * match published listings. Falls back to popular listings if no profile.
 */
export async function getRecommendedRackets(userId?: string, limit = 8) {
    let profile;
    try {
        profile = await getPlayerProfile(userId);
    } catch {
        profile = null;
    }

    const preferences = derivePreferences(profile);
    const conditions = [eq(products.status, "PUBLISHED")];

    if (preferences.weightClasses.length > 0) {
        conditions.push(inArray(products.weight_class, preferences.weightClasses));
    }
    if (preferences.balances.length > 0) {
        conditions.push(inArray(products.balance, preferences.balances));
    }
    if (preferences.shaftFlexes.length > 0) {
        conditions.push(inArray(products.shaft_flex, preferences.shaftFlexes));
    }

    const recs = await db.query.products.findMany({
        where: and(...conditions),
        limit,
        columns: {
            id: true,
            title: true,
            slug: true,
            price: true,
            images: true,
            weight_class: true,
            balance: true,
            shaft_flex: true,
        },
    });

    return {
        recommendations: recs,
        explanation: preferences.explanation,
    };
}

interface DerivedPrefs {
    weightClasses: string[];
    balances: string[];
    shaftFlexes: string[];
    explanation: string;
}

function derivePreferences(profile: typeof player_profiles.$inferSelect | null | undefined): DerivedPrefs {
    if (!profile) {
        return {
            weightClasses: [],
            balances: [],
            shaftFlexes: [],
            explanation: "Belum ada profil pemain — menampilkan listing populer.",
        };
    }

    const weight: string[] = [];
    const balance: string[] = [];
    const flex: string[] = [];
    const reasons: string[] = [];

    // Explicit preferences win.
    if (profile.preferred_weight_class) {
        weight.push(profile.preferred_weight_class);
        reasons.push(`weight ${profile.preferred_weight_class}`);
    }
    if (profile.preferred_balance) {
        balance.push(profile.preferred_balance);
        reasons.push(`balance ${profile.preferred_balance}`);
    }
    if (profile.preferred_shaft_flex) {
        flex.push(profile.preferred_shaft_flex);
        reasons.push(`shaft ${profile.preferred_shaft_flex}`);
    }

    // Defaults from level + style.
    if (weight.length === 0) {
        if (profile.level === "BEGINNER") {
            weight.push("4U", "5U");
            reasons.push("ringan untuk pemula");
        } else if (profile.level === "PRO" || profile.level === "ADVANCED") {
            weight.push("3U", "4U");
        } else {
            weight.push("4U");
        }
    }

    if (balance.length === 0 && profile.play_style) {
        if (profile.play_style === "OFFENSIVE" || profile.play_style === "DOUBLES_BACK") {
            balance.push("HEAD_HEAVY");
            reasons.push("smash kuat (head-heavy)");
        } else if (profile.play_style === "DEFENSIVE" || profile.play_style === "DOUBLES_FRONT") {
            balance.push("HEAD_LIGHT");
            reasons.push("manuver cepat (head-light)");
        } else {
            balance.push("EVEN");
            reasons.push("seimbang (even)");
        }
    }

    if (flex.length === 0) {
        if (profile.level === "BEGINNER") {
            flex.push("FLEXIBLE", "MEDIUM");
            reasons.push("shaft fleksibel untuk swing pemula");
        } else if (profile.level === "ADVANCED" || profile.level === "PRO") {
            flex.push("STIFF", "MEDIUM");
        }
    }

    return {
        weightClasses: weight,
        balances: balance,
        shaftFlexes: flex,
        explanation: `Cocok untuk profil Anda: ${reasons.join(", ")}.`,
    };
}

// String service add-on: created when buyer attaches the add-on at checkout.
const stringServiceSchema = z.object({
    orderItemId: z.string().uuid(),
    stringBrand: z.string().min(2).max(80),
    stringGauge: z.string().max(20).optional(),
    tensionLbs: z.number().int().min(15).max(40),
    serviceFee: z.number().min(0),
});

export async function addStringServiceToOrderItem(input: z.infer<typeof stringServiceSchema>) {
    await getCurrentUser();
    const validated = stringServiceSchema.parse(input);
    const { string_service_orders } = await import("@/db/schema");
    await db.insert(string_service_orders).values({
        order_item_id: validated.orderItemId,
        string_brand: validated.stringBrand,
        string_gauge: validated.stringGauge,
        tension_lbs: validated.tensionLbs,
        service_fee: String(validated.serviceFee),
        status: "PENDING",
    });
    return { success: true };
}

// Suppress unused-import warnings reserved for follow-up surfaces.
void users;
void or;
void lte;
void sql;
