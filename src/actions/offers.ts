"use server";

import { db } from "@/db";
import { offers, products, product_variants, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { and, desc, eq, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
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
});

export async function createOffer(input: z.infer<typeof createOfferSchema>) {
    const user = await getCurrentUser();
    const validated = createOfferSchema.parse(input);

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
            status: true,
        },
    });

    if (!product) throw new Error("Produk tidak ditemukan.");
    if (product.status !== "PUBLISHED") throw new Error("Produk tidak dapat ditawar saat ini.");
    if (!product.bargain_enabled) throw new Error("Penjual tidak mengaktifkan penawaran untuk produk ini.");
    if (product.seller_id === user.id) throw new Error("Anda tidak bisa menawar produk Anda sendiri.");
    if (validated.amount >= Number(product.price)) {
        throw new Error("Penawaran harus lebih rendah dari harga listing. Gunakan checkout normal.");
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
        throw new Error("Anda sudah punya penawaran aktif untuk produk ini.");
    }

    const expiresAt = addHours(new Date(), OFFER_TTL_HOURS);
    let initialStatus: "PENDING" | "REJECTED" = "PENDING";

    // Auto-decline if below threshold so offer never sits in seller queue.
    if (product.auto_decline_below !== null && validated.amount < Number(product.auto_decline_below)) {
        initialStatus = "REJECTED";
    }

    const [offer] = await db
        .insert(offers)
        .values({
            listing_id: validated.listingId,
            variant_id: validated.variantId ?? null,
            buyer_id: user.id,
            seller_id: product.seller_id,
            amount: String(validated.amount),
            status: initialStatus,
            round: 1,
            actor_role: "buyer",
            expires_at: expiresAt,
            decided_at: initialStatus === "REJECTED" ? new Date() : null,
            decided_by: initialStatus === "REJECTED" ? null : null,
            notes: validated.notes,
        })
        .returning();

    if (initialStatus === "PENDING") {
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

    return { success: true, offerId: offer.id, status: initialStatus, autoDeclined: initialStatus === "REJECTED" };
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
            listing_id: parent.listing_id,
            variant_id: parent.variant_id,
            buyer_id: parent.buyer_id,
            seller_id: parent.seller_id,
            amount: String(validated.amount),
            status: "PENDING",
            round: nextRound,
            parent_offer_id: parent.id,
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

// Suppress unused-import warnings reserved for follow-up surfaces.
void product_variants;
void users;
void isNotNull;
void ne;
void or;
