/**
 * Pricing helpers for cart lines that came from an accepted offer (carts.offer_id).
 * An offer line is "active" only while its offer is ACCEPTED, not yet checked out,
 * and inside the 24h window — then the negotiated amount overrides the list price.
 */

type OfferLite = {
    amount: string;
    status: string;
    checkout_token_used_at?: Date | string | null;
    checkout_token_expires_at?: Date | string | null;
} | null | undefined;

type CartLineLite = {
    offer_id?: string | null;
    offer?: OfferLite;
    variant?: { price: string | null } | null;
    product: { price: string };
    quantity?: number;
};

export function isOfferLineActive(offer: OfferLite, nowMs: number = Date.now()): boolean {
    if (!offer) return false;
    if (offer.status !== "ACCEPTED") return false;
    if (offer.checkout_token_used_at) return false;
    if (!offer.checkout_token_expires_at) return false;
    return new Date(offer.checkout_token_expires_at).getTime() > nowMs;
}

/** Unit price honoring a locked offer when present + valid, else the list price. */
export function effectiveUnitPrice(item: CartLineLite, nowMs: number = Date.now()): number {
    if (item.offer_id && isOfferLineActive(item.offer, nowMs)) {
        return parseFloat((item.offer as { amount: string }).amount);
    }
    return parseFloat(item.variant?.price ?? item.product.price);
}

/** Unit price as a string (for order_items.price snapshots). */
export function effectiveUnitPriceString(item: CartLineLite, nowMs: number = Date.now()): string {
    if (item.offer_id && isOfferLineActive(item.offer, nowMs)) {
        return (item.offer as { amount: string }).amount;
    }
    return item.variant?.price ?? item.product.price;
}
