"use server";

import { db } from "@/db";
import { buyer_reputation_summary, offers, products, product_variants, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clearOfferDraftCookie, setOfferDraftCookie } from "@/lib/offer-draft";
import { computeAutoCounterAmount, shouldTriggerAutoCounter } from "@/lib/offer-auto-counter";
import { headers } from "next/headers";
import { and, desc, eq, gte, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/format";

const OFFER_TTL_HOURS = Number(process.env.OFFER_TTL_HOURS || 48);
const ACCEPTED_CHECKOUT_TTL_HOURS = Number(process.env.OFFER_CHECKOUT_TTL_HOURS || 24);
const DEFAULT_MAX_ROUNDS = 3;

async function getCurrentUser() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        throw new Error("Unauthorized");
    }
    return session.user;
}

function generateCheckoutToken(): string {
    return randomBytes(24).toString("base64url");
}

function addHours(base: Date, hours: number): Date {
    return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

const createOfferSchema = z.object({
    listingId: z.string().uuid(),
    variantId: z.string().uuid().nullable().optional(),
    amount: z.number().positive(),
    notes: z.string().max(500).optional(),
    // DIF-13: Optional client-emitted intent telemetry. Server clamps to [0,100].
    intentSignal: z
        .object({
            timeOnPageMs: z.number().int().min(0).max(60 * 60 * 1000).optional(),
            scrollDepthPct: z.number().int().min(0).max(100).optional(),
        })
        .optional(),
});

/**
 * DIF-13: Compute a coarse 0–100 intent score from time-on-page + scroll depth.
 *
 * Goal: distinguish a buyer who skimmed for 4 seconds and clicked submit
 * (low-intent, possibly bot-like) from a buyer who read the listing for 90s
 * and scrolled the whole page (high-intent). Used as a default sort key in
 * the seller offer inbox.
 */
function computeIntentScore(signal?: {
    timeOnPageMs?: number;
    scrollDepthPct?: number;
}): { intentScore: number | null; scrollDepthPct: number | null } {
    if (!signal) return { intentScore: null, scrollDepthPct: null };
    const tMs = Math.max(0, signal.timeOnPageMs ?? 0);
    const scroll = Math.max(0, Math.min(100, signal.scrollDepthPct ?? 0));
    // log10(tMs) saturates: 1s=0, 1min=4.78, 1h=6.56. Cap raw at 5 (~30s).
    const timeComponent = tMs > 0 ? Math.min(60, Math.log10(Math.max(tMs, 100)) * 12) : 0;
    const scrollComponent = scroll * 0.4; // 0..40
    const raw = Math.round(timeComponent + scrollComponent);
    return {
        intentScore: Math.max(0, Math.min(100, raw)),
        scrollDepthPct: Math.round(scroll),
    };
}

const prepareOfferLoginSchema = z.object({
    listingId: z.string().uuid(),
    amount: z.number().positive(),
    returnPath: z.string().min(1).max(500),
});

const offerWinProbabilitySchema = z.object({
    listingId: z.string().uuid(),
    amount: z.number().positive(),
});

type TieredFloorPrice = {
    default?: number;
    high_trust?: number;
    platinum_buyer?: number;
};

function parseTieredFloorPrice(input: unknown): TieredFloorPrice | null {
    if (!input || typeof input !== "object") return null;
    const raw = input as Record<string, unknown>;
    const parsed: TieredFloorPrice = {};
    if (typeof raw.default === "number" && raw.default > 0) parsed.default = raw.default;
    if (typeof raw.high_trust === "number" && raw.high_trust > 0) parsed.high_trust = raw.high_trust;
    if (typeof raw.platinum_buyer === "number" && raw.platinum_buyer > 0) parsed.platinum_buyer = raw.platinum_buyer;
    return Object.keys(parsed).length > 0 ? parsed : null;
}

async function resolveEffectiveFloorPrice(input: {
    buyerId: string;
    listingFloorPrice: string | null;
    tieredFloorPrice: unknown;
}): Promise<number | null> {
    const baseFloor = input.listingFloorPrice !== null ? Number(input.listingFloorPrice) : null;
    const tierFloorEnabled = await isFeatureEnabled("dif.tier_floor_price", {
        userId: input.buyerId,
        bucketKey: input.buyerId,
    });

    if (!tierFloorEnabled) return baseFloor;

    const tiered = parseTieredFloorPrice(input.tieredFloorPrice);
    if (!tiered) return baseFloor;

    const [buyerSummary, buyerProfile] = await Promise.all([
        db.query.buyer_reputation_summary.findFirst({
            where: eq(buyer_reputation_summary.buyer_id, input.buyerId),
            columns: { band: true },
        }),
        db.query.users.findFirst({
            where: eq(users.id, input.buyerId),
            columns: { buyer_score: true, buyer_score_count: true },
        }),
    ]);

    const score = buyerProfile ? Number(buyerProfile.buyer_score) : 0;
    const count = buyerProfile?.buyer_score_count ?? 0;
    if (score >= 4.8 && count >= 20 && tiered.platinum_buyer) {
        return tiered.platinum_buyer;
    }
    if (buyerSummary?.band === "HIGH" && tiered.high_trust) {
        return tiered.high_trust;
    }
    if (tiered.default) {
        return tiered.default;
    }
    return baseFloor;
}

async function assertOfferAllowed(buyerId: string, listingId: string) {
    const rateLimitEnabled = await isFeatureEnabled("pdp.offer_rate_limit", {
        userId: buyerId,
        bucketKey: buyerId,
    });

    if (!rateLimitEnabled) {
        return { allowed: true as const, retryAfterSec: 0 };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentOffers = await db.query.offers.findMany({
        where: and(
            eq(offers.buyer_id, buyerId),
            eq(offers.listing_id, listingId),
            gte(offers.created_at, windowStart)
        ),
        orderBy: [desc(offers.created_at)],
        columns: {
            status: true,
            created_at: true,
            decided_at: true,
        },
        limit: 10,
    });

    if (recentOffers.length >= 3) {
        const oldest = recentOffers[recentOffers.length - 1];
        const retryAt = new Date(oldest.created_at.getTime() + 24 * 60 * 60 * 1000);
        const retryAfterSec = Math.max(1, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));
        if (retryAfterSec > 0) {
            return { allowed: false as const, retryAfterSec };
        }
    }

    let consecutiveRejects = 0;
    let latestRejectedAt: Date | null = null;
    for (const offer of recentOffers) {
        if (offer.status !== "REJECTED") break;
        consecutiveRejects += 1;
        latestRejectedAt = latestRejectedAt ?? offer.decided_at ?? offer.created_at;
    }

    if (latestRejectedAt && consecutiveRejects > 0) {
        const cooldownHours = Math.min(2 ** consecutiveRejects, 8);
        const retryAt = new Date(latestRejectedAt.getTime() + cooldownHours * 60 * 60 * 1000);
        const retryAfterSec = Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000));
        if (retryAfterSec > 0) {
            return { allowed: false as const, retryAfterSec };
        }
    }

    return { allowed: true as const, retryAfterSec: 0 };
}

export async function prepareOfferLoginDraft(input: z.infer<typeof prepareOfferLoginSchema>) {
    const validated = prepareOfferLoginSchema.parse(input);
    await setOfferDraftCookie({
        productId: validated.listingId,
        amount: String(Math.round(validated.amount)),
        returnPath: validated.returnPath,
    });

    return {
        success: true as const,
        loginUrl: `/auth/login?callbackUrl=${encodeURIComponent(validated.returnPath)}`,
    };
}

export async function getOfferWinProbability(input: z.infer<typeof offerWinProbabilitySchema>) {
    const validated = offerWinProbabilitySchema.parse(input);
    const listing = await db.query.products.findFirst({
        where: eq(products.id, validated.listingId),
        columns: { id: true, category_id: true, price: true },
    });
    if (!listing || !listing.category_id) {
        return { probabilityPct: null, sampleSize: 0, bucket: "unknown" as const };
    }

    const targetDiscountPct = (1 - validated.amount / Number(listing.price)) * 100;
    const bucket = targetDiscountPct < 10 ? "lt10" : targetDiscountPct < 20 ? "10_20" : targetDiscountPct < 35 ? "20_35" : "gte35";

    const rows = await db
        .select({
            amount: offers.amount,
            price: products.price,
            status: offers.status,
        })
        .from(offers)
        .innerJoin(products, eq(offers.listing_id, products.id))
        .where(
            and(
                eq(products.category_id, listing.category_id),
                sql`${offers.status} IN ('ACCEPTED', 'REJECTED')`
            )
        )
        .orderBy(desc(offers.created_at))
        .limit(400);

    const filtered = rows.filter((row) => {
        const discount = (1 - Number(row.amount) / Number(row.price)) * 100;
        if (bucket === "lt10") return discount < 10;
        if (bucket === "10_20") return discount >= 10 && discount < 20;
        if (bucket === "20_35") return discount >= 20 && discount < 35;
        return discount >= 35;
    });

    const sample = filtered.length > 0 ? filtered : rows;
    if (sample.length === 0) {
        return { probabilityPct: null, sampleSize: 0, bucket };
    }

    const accepted = sample.filter((row) => row.status === "ACCEPTED").length;
    return {
        probabilityPct: Math.round((accepted / sample.length) * 100),
        sampleSize: sample.length,
        bucket,
    };
}

export async function createOffer(input: z.infer<typeof createOfferSchema>) {
    const user = await getCurrentUser();
    const validated = createOfferSchema.parse(input);

    const allowance = await assertOfferAllowed(user.id, validated.listingId);
    if (!allowance.allowed) {
        return {
            success: false as const,
            error: "rate_limited" as const,
            retryAfterSec: allowance.retryAfterSec,
        };
    }

    const product = await db.query.products.findFirst({
        where: eq(products.id, validated.listingId),
        columns: {
            id: true,
            title: true,
            seller_id: true,
            price: true,
            bargain_enabled: true,
            min_acceptable_price: true,
            max_offer_rounds: true,
            auto_decline_below: true,
            floor_price: true,
            tiered_floor_price: true,
            status: true,
        },
    });

    if (!product) {
        return { success: false as const, error: "not_found" as const, message: "Produk tidak ditemukan." };
    }
    if (product.status !== "PUBLISHED") {
        return { success: false as const, error: "not_available" as const, message: "Produk tidak dapat ditawar saat ini." };
    }
    if (!product.bargain_enabled) {
        return { success: false as const, error: "bargain_disabled" as const, message: "Penjual tidak mengaktifkan penawaran untuk produk ini." };
    }
    if (product.seller_id === user.id) {
        return { success: false as const, error: "self_offer" as const, message: "Anda tidak bisa menawar produk Anda sendiri." };
    }
    if (validated.amount >= Number(product.price)) {
        return { success: false as const, error: "above_listing" as const, message: "Penawaran harus lebih rendah dari harga listing. Gunakan checkout normal." };
    }

    // Reject if there is already an active offer for this listing from this buyer.
    const existingActive = await db.query.offers.findFirst({
        where: and(
            eq(offers.listing_id, validated.listingId),
            eq(offers.buyer_id, user.id),
            sql`${offers.status} IN ('PENDING', 'COUNTERED', 'ACCEPTED')`
        ),
        columns: { id: true, status: true },
    });
    if (existingActive) {
        return {
            success: false as const,
            error: "duplicate_active" as const,
            message: "Anda sudah punya penawaran aktif untuk produk ini.",
            existingOfferId: existingActive.id,
        };
    }

    const expiresAt = addHours(new Date(), OFFER_TTL_HOURS);
    const offerId = randomUUID();
    let initialStatus: "PENDING" | "REJECTED" = "PENDING";

    // Auto-decline if below threshold so offer never sits in seller queue.
    if (product.auto_decline_below !== null && validated.amount < Number(product.auto_decline_below)) {
        initialStatus = "REJECTED";
    }

    const effectiveFloorPrice = await resolveEffectiveFloorPrice({
        buyerId: user.id,
        listingFloorPrice: product.floor_price,
        tieredFloorPrice: product.tiered_floor_price,
    });

    const autoCounterEnabled = await isFeatureEnabled("dif.auto_counter", {
        userId: user.id,
        bucketKey: user.id,
    });
    const shouldAutoCounter =
        initialStatus === "PENDING" &&
        autoCounterEnabled &&
        shouldTriggerAutoCounter({
            offerAmount: validated.amount,
            floorPrice: effectiveFloorPrice,
        });

    const intent = computeIntentScore(validated.intentSignal);

    const [offer] = await db
        .insert(offers)
        .values({
            id: offerId,
            listing_id: validated.listingId,
            variant_id: validated.variantId ?? null,
            buyer_id: user.id,
            seller_id: product.seller_id,
            amount: String(validated.amount),
            status: initialStatus,
            round: 1,
            root_offer_id: offerId,
            is_auto_counter: false,
            intent_score: intent.intentScore ?? undefined,
            scroll_depth_pct: intent.scrollDepthPct ?? undefined,
            actor_role: "buyer",
            expires_at: expiresAt,
            decided_at: initialStatus === "REJECTED" ? new Date() : null,
            decided_by: initialStatus === "REJECTED" ? null : null,
            notes: validated.notes,
        })
        .returning();

    let autoCounterOfferId: string | null = null;
    let autoCounterAmount: number | null = null;

    if (shouldAutoCounter) {
        const floorPrice = Number(effectiveFloorPrice);
        const suggested = computeAutoCounterAmount({
            offerAmount: validated.amount,
            floorPrice,
        });

        await db
            .update(offers)
            .set({
                status: "COUNTERED",
                decided_at: new Date(),
                notes: validated.notes ?? "Ditandai untuk auto-counter.",
            })
            .where(and(eq(offers.id, offer.id), eq(offers.status, "PENDING")));

        const [counter] = await db
            .insert(offers)
            .values({
                id: randomUUID(),
                listing_id: validated.listingId,
                variant_id: validated.variantId ?? null,
                buyer_id: user.id,
                seller_id: product.seller_id,
                amount: String(suggested),
                status: "PENDING",
                round: 2,
                parent_offer_id: offer.id,
                root_offer_id: offer.id,
                is_auto_counter: true,
                actor_role: "seller",
                expires_at: expiresAt,
                notes: "JBR auto-counter berdasarkan floor price seller.",
            })
            .onConflictDoNothing()
            .returning({ id: offers.id });

        if (counter) {
            autoCounterOfferId = counter.id;
            autoCounterAmount = suggested;
            await notify({
                event: "OFFER_RECEIVED",
                recipientUserId: offer.buyer_id,
                offerId: counter.id,
                productTitle: product.title,
                amount: formatCurrency(suggested),
                actorName: "JBR Auto Counter",
                round: 2,
            });
        }
    }

    if (initialStatus === "PENDING" && !autoCounterOfferId) {
        await notify({
            event: "OFFER_RECEIVED",
            recipientUserId: product.seller_id,
            offerId: offer.id,
            productTitle: product.title,
            amount: formatCurrency(validated.amount),
            actorName: user.name || "Pembeli",
            round: 1,
        });
    }

    revalidatePath(`/product/${validated.listingId}`);
    revalidatePath("/seller/offers");
    revalidatePath("/profile/offers");
    await clearOfferDraftCookie();

    return {
        success: true,
        offerId: offer.id,
        status: initialStatus,
        autoDeclined: initialStatus === "REJECTED",
        autoCounterTriggered: Boolean(autoCounterOfferId),
        autoCounterOfferId,
        autoCounterAmount,
    };
}

const counterOfferSchema = z.object({
    parentOfferId: z.string().uuid(),
    amount: z.number().positive(),
    notes: z.string().max(500).optional(),
});

export async function counterOffer(input: z.infer<typeof counterOfferSchema>) {
    const user = await getCurrentUser();
    const validated = counterOfferSchema.parse(input);

    const parent = await db.query.offers.findFirst({
        where: eq(offers.id, validated.parentOfferId),
    });

    if (!parent) throw new Error("Penawaran tidak ditemukan.");
    if (parent.status !== "PENDING") throw new Error("Penawaran tidak dapat di-counter pada status saat ini.");
    if (parent.buyer_id !== user.id && parent.seller_id !== user.id) {
        throw new Error("Anda bukan peserta penawaran ini.");
    }

    const product = await db.query.products.findFirst({
        where: eq(products.id, parent.listing_id),
        columns: {
            id: true,
            title: true,
            price: true,
            max_offer_rounds: true,
        },
    });
    if (!product) throw new Error("Produk tidak ditemukan.");

    const maxRounds = product.max_offer_rounds ?? DEFAULT_MAX_ROUNDS;
    const nextRound = parent.round + 1;
    if (nextRound > maxRounds) {
        throw new Error(`Penawaran sudah mencapai batas ${maxRounds} ronde.`);
    }
    if (validated.amount >= Number(product.price)) {
        throw new Error("Counter harus lebih rendah dari harga listing.");
    }

    const isSeller = user.id === parent.seller_id;
    const actorRole = isSeller ? "seller" : "buyer";
    const recipientId = isSeller ? parent.buyer_id : parent.seller_id;

    // Mark parent as COUNTERED.
    await db
        .update(offers)
        .set({
            status: "COUNTERED",
            decided_at: new Date(),
            decided_by: user.id,
        })
        .where(eq(offers.id, parent.id));

    const expiresAt = addHours(new Date(), OFFER_TTL_HOURS);
    const [child] = await db
        .insert(offers)
        .values({
            id: randomUUID(),
            listing_id: parent.listing_id,
            variant_id: parent.variant_id,
            buyer_id: parent.buyer_id,
            seller_id: parent.seller_id,
            amount: String(validated.amount),
            status: "PENDING",
            round: nextRound,
            parent_offer_id: parent.id,
            root_offer_id: parent.root_offer_id,
            is_auto_counter: false,
            actor_role: actorRole,
            expires_at: expiresAt,
            notes: validated.notes,
        })
        .returning();

    await notify({
        event: "OFFER_RECEIVED",
        recipientUserId: recipientId,
        offerId: child.id,
        productTitle: product.title,
        amount: formatCurrency(validated.amount),
        actorName: user.name || (isSeller ? "Penjual" : "Pembeli"),
        round: nextRound,
    });

    revalidatePath("/seller/offers");
    revalidatePath("/profile/offers");

    return { success: true, offerId: child.id, round: nextRound };
}

export async function acceptOffer(offerId: string) {
    const user = await getCurrentUser();

    const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
        with: {
            listing: {
                columns: { id: true, title: true, stock: true, status: true, min_acceptable_price: true },
            },
        },
    });

    if (!offer) throw new Error("Penawaran tidak ditemukan.");
    if (offer.status !== "PENDING") throw new Error("Penawaran tidak dapat diterima pada status saat ini.");

    // Acceptor must be the recipient of the latest move (the other party to the actor_role).
    const expectedAcceptorId = offer.actor_role === "buyer" ? offer.seller_id : offer.buyer_id;
    if (user.id !== expectedAcceptorId) {
        throw new Error("Hanya pihak penerima penawaran yang dapat menerima.");
    }

    if (offer.expires_at <= new Date()) {
        throw new Error("Penawaran sudah kadaluarsa.");
    }

    const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
    if (!listing) {
        throw new Error("Produk tidak ditemukan.");
    }

    if (listing.status !== "PUBLISHED") {
        throw new Error("Produk sudah tidak tersedia.");
    }

    if (listing.stock <= 0) {
        throw new Error("Stok produk habis.");
    }

    if (
        listing.min_acceptable_price !== null &&
        Number(offer.amount) < Number(listing.min_acceptable_price)
    ) {
        throw new Error("Penawaran di bawah harga minimum yang diizinkan.");
    }

    const token = generateCheckoutToken();
    const checkoutExpiresAt = addHours(new Date(), ACCEPTED_CHECKOUT_TTL_HOURS);

    await db
        .update(offers)
        .set({
            status: "ACCEPTED",
            decided_at: new Date(),
            decided_by: user.id,
            checkout_token: token,
            checkout_token_expires_at: checkoutExpiresAt,
        })
        .where(eq(offers.id, offer.id));

    await notify({
        event: "OFFER_ACCEPTED",
        recipientUserId: offer.buyer_id,
        offerId: offer.id,
        productTitle: listing.title,
        amount: formatCurrency(Number(offer.amount)),
    });

    revalidatePath("/seller/offers");
    revalidatePath("/profile/offers");

    return { success: true, checkoutToken: token, checkoutExpiresAt: checkoutExpiresAt.toISOString() };
}

export async function rejectOffer(offerId: string, notes?: string) {
    const user = await getCurrentUser();

    const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
        columns: {
            id: true,
            status: true,
            buyer_id: true,
            seller_id: true,
            actor_role: true,
        },
    });
    if (!offer) throw new Error("Penawaran tidak ditemukan.");
    if (offer.status !== "PENDING") throw new Error("Penawaran tidak dapat ditolak pada status saat ini.");

    const expectedRejecterId = offer.actor_role === "buyer" ? offer.seller_id : offer.buyer_id;
    if (user.id !== expectedRejecterId) {
        throw new Error("Hanya pihak penerima penawaran yang dapat menolak.");
    }

    await db
        .update(offers)
        .set({
            status: "REJECTED",
            decided_at: new Date(),
            decided_by: user.id,
            notes: notes ? notes.slice(0, 500) : undefined,
        })
        .where(eq(offers.id, offer.id));

    revalidatePath("/seller/offers");
    revalidatePath("/profile/offers");

    return { success: true };
}

export async function withdrawOffer(offerId: string) {
    const user = await getCurrentUser();

    const offer = await db.query.offers.findFirst({
        where: eq(offers.id, offerId),
        columns: { id: true, status: true, buyer_id: true, seller_id: true, actor_role: true },
    });
    if (!offer) throw new Error("Penawaran tidak ditemukan.");
    if (offer.status !== "PENDING") throw new Error("Penawaran tidak dapat ditarik pada status saat ini.");

    // Only the actor who made the latest move can withdraw it.
    const actorId = offer.actor_role === "buyer" ? offer.buyer_id : offer.seller_id;
    if (actorId !== user.id) {
        throw new Error("Hanya pihak yang membuat penawaran terakhir dapat menariknya.");
    }

    await db
        .update(offers)
        .set({
            status: "WITHDRAWN",
            decided_at: new Date(),
            decided_by: user.id,
        })
        .where(eq(offers.id, offer.id));

    revalidatePath("/seller/offers");
    revalidatePath("/profile/offers");

    return { success: true };
}

export interface OfferExpirySweepResult {
    inspected: number;
    expired: number;
    expiredIds: string[];
}

export interface OfferSlaFollowupSweepResult {
    inspected: number;
    reminded: number;
    remindedIds: string[];
    expiredBySla: number;
}

export async function runOfferExpirySweep(): Promise<OfferExpirySweepResult> {
    const now = new Date();

    const overdue = await db
        .select({ id: offers.id })
        .from(offers)
        .where(and(eq(offers.status, "PENDING"), lte(offers.expires_at, now)));

    const expiredIds: string[] = [];
    for (const row of overdue) {
        const updated = await db
            .update(offers)
            .set({ status: "EXPIRED", decided_at: now })
            .where(and(eq(offers.id, row.id), eq(offers.status, "PENDING")))
            .returning({ id: offers.id });
        if (updated[0]) expiredIds.push(updated[0].id);
    }

    return {
        inspected: overdue.length,
        expired: expiredIds.length,
        expiredIds,
    };
}

export async function runOfferSlaFollowupSweep(): Promise<OfferSlaFollowupSweepResult> {
    const now = new Date();
    const cutoff24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const candidates = await db.query.offers.findMany({
        where: and(
            eq(offers.status, "PENDING"),
            lte(offers.created_at, cutoff24),
            gte(offers.expires_at, now)
        ),
        with: {
            listing: {
                columns: {
                    id: true,
                    title: true,
                    category_id: true,
                    price: true,
                },
            },
        },
        limit: 200,
        orderBy: [desc(offers.created_at)],
    });

    const remindedIds: string[] = [];
    let expiredBySla = 0;
    for (const offer of candidates) {
        const listing = Array.isArray(offer.listing) ? offer.listing[0] : offer.listing;
        const ageHours = Math.floor((now.getTime() - offer.created_at.getTime()) / (60 * 60 * 1000));

        if (offer.actor_role === "buyer" && ageHours >= 72) {
            await db
                .update(offers)
                .set({ status: "EXPIRED", decided_at: now })
                .where(and(eq(offers.id, offer.id), eq(offers.status, "PENDING")));

            let suggestions: Array<{ id: string; slug: string; title: string }> = [];
            if (listing?.category_id) {
                const rows = await db.query.products.findMany({
                    where: and(
                        eq(products.category_id, listing.category_id),
                        eq(products.status, "PUBLISHED"),
                        ne(products.id, listing.id)
                    ),
                    columns: { id: true, slug: true, title: true },
                    limit: 3,
                    orderBy: [desc(products.views)],
                });
                suggestions = rows;
            }

            await notify({
                event: "OFFER_SLA_REMINDER",
                recipientUserId: offer.buyer_id,
                offerId: offer.id,
                productTitle: listing?.title ?? "Produk",
                amount: formatCurrency(Number(offer.amount)),
                stage: "T72_EXPIRED",
                suggestions,
                idempotencyKey: `OFFER_SLA_REMINDER:T72:${offer.id}`,
            });
            expiredBySla += 1;
            continue;
        }

        if (offer.actor_role === "buyer" && ageHours >= 48) {
            await notify({
                event: "OFFER_SLA_REMINDER",
                recipientUserId: offer.buyer_id,
                offerId: offer.id,
                productTitle: listing?.title ?? "Produk",
                amount: formatCurrency(Number(offer.amount)),
                stage: "T48_BUYER_WAITING",
                idempotencyKey: `OFFER_SLA_REMINDER:T48:${offer.id}`,
            });
            remindedIds.push(offer.id);
            continue;
        }

        if (offer.actor_role === "buyer" && ageHours >= 24) {
            await notify({
                event: "OFFER_SLA_REMINDER",
                recipientUserId: offer.seller_id,
                offerId: offer.id,
                productTitle: listing?.title ?? "Produk",
                amount: formatCurrency(Number(offer.amount)),
                stage: "T24_SELLER_PENDING",
                idempotencyKey: `OFFER_SLA_REMINDER:T24:${offer.id}`,
            });
            remindedIds.push(offer.id);
        }
    }

    return {
        inspected: candidates.length,
        reminded: remindedIds.length,
        remindedIds,
        expiredBySla,
    };
}

// ============================================
// Listings for inbox UIs
// ============================================
export async function listSellerOffers(filter?: { status?: "PENDING" | "ACCEPTED" | "REJECTED" | "COUNTERED" | "EXPIRED" | "WITHDRAWN" }) {
    const user = await getCurrentUser();
    return db.query.offers.findMany({
        where: filter?.status
            ? and(eq(offers.seller_id, user.id), eq(offers.status, filter.status))
            : eq(offers.seller_id, user.id),
        orderBy: [desc(offers.created_at)],
        with: {
            listing: { columns: { id: true, title: true, slug: true, price: true } },
            buyer: { columns: { id: true, name: true } },
        },
    });
}

export async function listBuyerOffers() {
    const user = await getCurrentUser();
    return db.query.offers.findMany({
        where: eq(offers.buyer_id, user.id),
        orderBy: [desc(offers.created_at)],
        with: {
            listing: { columns: { id: true, title: true, slug: true, price: true } },
            seller: { columns: { id: true, name: true, store_name: true } },
        },
    });
}

// ============================================
// BARG-03: Locked checkout token resolution
// ============================================
export async function resolveCheckoutToken(token: string) {
    const user = await getCurrentUser();
    const offer = await db.query.offers.findFirst({
        where: eq(offers.checkout_token, token),
        with: {
            listing: { columns: { id: true, title: true, slug: true, price: true, stock: true, status: true } },
            variant: { columns: { id: true, name: true, price: true, stock: true } },
        },
    });

    if (!offer) throw new Error("Token checkout tidak valid.");
    if (offer.buyer_id !== user.id) throw new Error("Token ini bukan milik akun Anda.");
    if (offer.status !== "ACCEPTED") throw new Error("Penawaran tidak berstatus diterima.");
    if (offer.checkout_token_used_at) throw new Error("Token sudah digunakan untuk pesanan.");
    if (offer.checkout_token_expires_at && offer.checkout_token_expires_at <= new Date()) {
        throw new Error("Token checkout sudah kadaluarsa.");
    }

    return {
        offerId: offer.id,
        amount: Number(offer.amount),
        listing: offer.listing,
        variant: offer.variant,
        expiresAt: offer.checkout_token_expires_at,
    };
}

export async function consumeCheckoutToken(offerId: string, orderId: string) {
    await db
        .update(offers)
        .set({
            checkout_token_used_at: new Date(),
            notes: sql`coalesce(${offers.notes}, '') || ' [used by order ' || ${orderId} || ']'`,
        })
        .where(eq(offers.id, offerId));
    return { success: true };
}

export async function getSellerNegotiationInsights() {
    const user = await getCurrentUser();

    const acceptedByHour = await db.execute(sql`
        SELECT
            EXTRACT(HOUR FROM o.created_at)::int AS hour,
            COUNT(*)::int AS accepted_count
        FROM offers o
        WHERE o.seller_id = ${user.id}
          AND o.status = 'ACCEPTED'
        GROUP BY 1
        ORDER BY 2 DESC
        LIMIT 6
    `);

    const discountBands = await db.execute(sql`
        SELECT
            CASE
                WHEN ((p.price::numeric - o.amount::numeric) / NULLIF(p.price::numeric, 0)) * 100 < 10 THEN '<10%'
                WHEN ((p.price::numeric - o.amount::numeric) / NULLIF(p.price::numeric, 0)) * 100 < 20 THEN '10-20%'
                WHEN ((p.price::numeric - o.amount::numeric) / NULLIF(p.price::numeric, 0)) * 100 < 35 THEN '20-35%'
                ELSE '>=35%'
            END AS band,
            COUNT(*)::int AS total
        FROM offers o
        INNER JOIN products p ON p.id = o.listing_id
        WHERE o.seller_id = ${user.id}
          AND o.status = 'ACCEPTED'
        GROUP BY 1
        ORDER BY 2 DESC
    `);

    const floorSuggestions = await db.execute(sql`
        SELECT
            p.id,
            p.title,
            percentile_disc(0.25) WITHIN GROUP (ORDER BY o.amount::numeric)::numeric(12,2) AS suggested_floor,
            COUNT(*)::int AS sample_size
        FROM offers o
        INNER JOIN products p ON p.id = o.listing_id
        WHERE o.seller_id = ${user.id}
          AND o.status = 'ACCEPTED'
        GROUP BY p.id, p.title
        HAVING COUNT(*) >= 3
        ORDER BY sample_size DESC
        LIMIT 8
    `);

    return {
        acceptedByHour: acceptedByHour as unknown as Array<{ hour: number; accepted_count: number }> ,
        discountBands: discountBands as unknown as Array<{ band: string; total: number }>,
        floorSuggestions: floorSuggestions as unknown as Array<{ id: string; title: string; suggested_floor: string; sample_size: number }>,
    };
}

// Suppress unused-import warnings reserved for follow-up surfaces.
void product_variants;
void users;
void isNotNull;
void ne;
void or;
