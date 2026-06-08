// Per-user, per-category notification preferences. Pure module (no server/db
// imports) so it can be shared by server actions, notify(), and client UI.

export const NOTIFICATION_CATEGORIES = [
    "orders",
    "chat",
    "offers",
    "reviews",
    "disputes",
    "promotions",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export interface ChannelPrefs {
    email: boolean;
    inApp: boolean;
}

export type NotificationPreferences = Record<NotificationCategory, ChannelPrefs>;

// Everything defaults ON (opt-out model).
export const DEFAULT_CHANNEL_PREFS: ChannelPrefs = { email: true, inApp: true };

export function defaultNotificationPreferences(): NotificationPreferences {
    return NOTIFICATION_CATEGORIES.reduce((acc, key) => {
        acc[key] = { ...DEFAULT_CHANNEL_PREFS };
        return acc;
    }, {} as NotificationPreferences);
}

// UI metadata. `critical` categories warn the user before disabling email
// (risk of missing order/payment info → potential lost sales).
export interface NotificationCategoryMeta {
    key: NotificationCategory;
    label: string;
    description: string;
    critical?: boolean;
}

export const NOTIFICATION_CATEGORY_META: NotificationCategoryMeta[] = [
    {
        key: "orders",
        label: "Pesanan & Pembayaran",
        description: "Pesanan dibuat, pembayaran, pengiriman, pesanan selesai, dan refund.",
        critical: true,
    },
    {
        key: "chat",
        label: "Chat / Pesan",
        description: "Pesan masuk dan pengingat saat pesan belum dibalas lebih dari 1 jam.",
    },
    {
        key: "offers",
        label: "Penawaran",
        description: "Penawaran masuk, counter, diterima, dan pengingat SLA.",
    },
    {
        key: "reviews",
        label: "Ulasan",
        description: "Ulasan baru untuk produk Anda dan balasan ulasan.",
    },
    {
        key: "disputes",
        label: "Sengketa",
        description: "Pembukaan dan pembaruan status sengketa pesanan.",
    },
    {
        key: "promotions",
        label: "Promo & Diskon",
        description: "Harga wishlist turun, pengingat keranjang, dan ringkasan toko mingguan.",
    },
];

// Map a notify() event to its preference category.
const EVENT_CATEGORY: Record<string, NotificationCategory> = {
    ORDER_CREATED: "orders",
    PAYMENT_SUCCESS: "orders",
    ORDER_SHIPPED: "orders",
    ORDER_DELIVERED: "orders",
    ORDER_COMPLETED: "orders",
    ORDER_REFUNDED: "orders",
    OFFER_RECEIVED: "offers",
    OFFER_ACCEPTED: "offers",
    OFFER_SLA_REMINDER: "offers",
    NEW_MESSAGE: "chat",
    CHAT_REMINDER: "chat",
    REVIEW_RECEIVED: "reviews",
    REVIEW_REPLY: "reviews",
    DISPUTE_OPENED: "disputes",
    DISPUTE_UPDATED: "disputes",
    WISHLIST_PRICE_DROP: "promotions",
    CART_ABANDONMENT_REMINDER: "promotions",
    SELLER_WEEKLY_DIGEST: "promotions",
};

export function categoryForEvent(event: string): NotificationCategory {
    // Default unknown/system events to "orders" (always-on transactional bucket).
    return EVENT_CATEGORY[event] ?? "orders";
}

function isChannelPrefs(value: unknown): value is Partial<ChannelPrefs> {
    return typeof value === "object" && value !== null;
}

/**
 * Merge stored (possibly partial) preferences over the defaults, so every
 * category × channel resolves to a concrete boolean. `legacyPromoOptIn` seeds
 * promotions.email when the stored prefs don't specify it (back-compat with the
 * old single flag).
 */
export function resolveNotificationPreferences(
    raw: unknown,
    legacyPromoOptIn?: boolean | null,
): NotificationPreferences {
    const resolved = defaultNotificationPreferences();

    if (typeof legacyPromoOptIn === "boolean") {
        resolved.promotions.email = legacyPromoOptIn;
    }

    if (raw && typeof raw === "object") {
        for (const key of NOTIFICATION_CATEGORIES) {
            const stored = (raw as Record<string, unknown>)[key];
            if (isChannelPrefs(stored)) {
                if (typeof stored.email === "boolean") resolved[key].email = stored.email;
                if (typeof stored.inApp === "boolean") resolved[key].inApp = stored.inApp;
            }
        }
    }

    return resolved;
}
