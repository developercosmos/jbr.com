import {
    pgTable,
    text,
    timestamp,
    integer,
    decimal,
    boolean,
    pgEnum,
    uuid,
    jsonb,
    uniqueIndex,
    index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// ENUMS
// ============================================
export const userRoleEnum = pgEnum("user_role", ["USER", "ADMIN"]);
export const storeStatusEnum = pgEnum("store_status", ["ACTIVE", "PENDING_REVIEW", "VACATION", "BANNED"]);
export const sellerTierEnum = pgEnum("seller_tier", ["T0", "T1", "T2"]);
export const kycStatusEnum = pgEnum("kyc_status", ["NOT_SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED"]);
export const productConditionEnum = pgEnum("product_condition", ["NEW", "PRELOVED"]);
export const productStatusEnum = pgEnum("product_status", ["DRAFT", "PUBLISHED", "ARCHIVED", "MODERATED"]);
export const orderStatusEnum = pgEnum("order_status", [
    "PENDING_PAYMENT",
    "PAID",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
]);
export const genderEnum = pgEnum("gender", ["UNISEX", "MEN", "WOMEN"]);
export const paymentStatusEnum = pgEnum("payment_status", [
    "PENDING",
    "PAID",
    "EXPIRED",
    "FAILED",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
    "ORDER_CREATED",
    "PAYMENT_SUCCESS",
    "ORDER_SHIPPED",
    "ORDER_DELIVERED",
    "ORDER_COMPLETED",
    "REVIEW_RECEIVED",
    "NEW_MESSAGE",
    "NEW_REVIEW",
    "REVIEW_REPLY",
    "DISPUTE_OPENED",
    "DISPUTE_UPDATED",
    "OFFER_RECEIVED",
    "OFFER_ACCEPTED",
    "AFFILIATE_CONVERSION",
    "PAYOUT_PROCESSED",
    "SELLER_ACTIVATED",
    "SELLER_REVIEW_NEEDED",
    "WISHLIST_PRICE_DROP",
    "CART_ABANDONMENT_REMINDER",
    "SELLER_WEEKLY_DIGEST",
    "SYSTEM",
]);


// ============================================
// USERS TABLE
// ============================================
export const users = pgTable(
    "users",
    {
        id: text("id").primaryKey(),
        name: text("name").notNull(),
        email: text("email").notNull().unique(),
        email_verified: boolean("email_verified").default(false),
        image: text("image"),
        phone: text("phone"),
        locale: text("locale").default("id-ID"),
        role: userRoleEnum("role").default("USER").notNull(),
        tier: sellerTierEnum("tier").default("T0").notNull(),
        // Seller-specific fields
        store_name: text("store_name"),
        store_slug: text("store_slug").unique(),
        store_description: text("store_description"),
        store_tagline: text("store_tagline"),
        store_banner_url: text("store_banner_url"),
        payout_bank_name: text("payout_bank_name"),
        store_status: storeStatusEnum("store_status").default("ACTIVE"),
        store_review_notes: text("store_review_notes"),
        store_reviewed_at: timestamp("store_reviewed_at"),
        store_reviewer_id: text("store_reviewer_id").references(() => users.id, { onDelete: "set null" }),
        buyer_score: decimal("buyer_score", { precision: 3, scale: 2 }).default("0").notNull(),
        buyer_score_count: integer("buyer_score_count").default(0).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        email_idx: uniqueIndex("idx_users_email").on(table.email),
        store_slug_idx: uniqueIndex("idx_users_store_slug").on(table.store_slug),
    })
);

// ============================================
// SELLER RATINGS (RATE-01) - aggregate per seller user
// ============================================
export const seller_ratings = pgTable("seller_ratings", {
    user_id: text("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    avg_rating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0").notNull(),
    rating_count: integer("rating_count").default(0).notNull(),
    completion_rate: decimal("completion_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    response_time_minutes_avg: integer("response_time_minutes_avg").default(0).notNull(),
    cancellation_rate: decimal("cancellation_rate", { precision: 5, scale: 2 }).default("0").notNull(),
    last_recomputed_at: timestamp("last_recomputed_at").defaultNow().notNull(),
});

export const sellerRatingsRelations = relations(seller_ratings, ({ one }) => ({
    seller: one(users, {
        fields: [seller_ratings.user_id],
        references: [users.id],
        relationName: "seller_ratings_user",
    }),
}));

// ============================================
// BUYER RATINGS (RATE-02) - per-order, two-direction with reveal window
// ============================================
export const buyer_ratings = pgTable(
    "buyer_ratings",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_id: uuid("order_id")
            .notNull()
            .references(() => orders.id, { onDelete: "cascade" }),
        rater_id: text("rater_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        ratee_id: text("ratee_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        direction: text("direction").notNull(),
        rating: integer("rating").notNull(),
        tags: text("tags").array(),
        comment: text("comment"),
        submitted_at: timestamp("submitted_at").defaultNow().notNull(),
    },
    (table) => ({
        unique_per_direction: uniqueIndex("buyer_ratings_unique").on(table.order_id, table.direction),
        ratee_idx: index("idx_buyer_ratings_ratee").on(table.ratee_id),
        order_idx: index("idx_buyer_ratings_order").on(table.order_id),
    })
);

export const buyerRatingsRelations = relations(buyer_ratings, ({ one }) => ({
    order: one(orders, {
        fields: [buyer_ratings.order_id],
        references: [orders.id],
    }),
    rater: one(users, {
        fields: [buyer_ratings.rater_id],
        references: [users.id],
        relationName: "buyer_ratings_rater",
    }),
    ratee: one(users, {
        fields: [buyer_ratings.ratee_id],
        references: [users.id],
        relationName: "buyer_ratings_ratee",
    }),
}));

// ============================================
// SESSIONS TABLE (Better Auth)
// ============================================
export const sessions = pgTable("sessions", {
    id: text("id").primaryKey(),
    user_id: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expires_at: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
    ip_address: text("ip_address"),
    user_agent: text("user_agent"),
});

// ============================================
// ACCOUNTS TABLE (Better Auth - OAuth)
// ============================================
export const accounts = pgTable("accounts", {
    id: text("id").primaryKey(),
    user_id: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    account_id: text("account_id").notNull(),
    provider_id: text("provider_id").notNull(),
    access_token: text("access_token"),
    refresh_token: text("refresh_token"),
    access_token_expires_at: timestamp("access_token_expires_at"),
    refresh_token_expires_at: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    id_token: text("id_token"),
    password: text("password"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// VERIFICATION TABLE (Better Auth - Email OTP)
// ============================================
export const verifications = pgTable("verifications", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expires_at: timestamp("expires_at").notNull(),
    created_at: timestamp("created_at").defaultNow(),
    updated_at: timestamp("updated_at").defaultNow(),
});

// ============================================
// CATEGORIES TABLE
// ============================================
export const categories = pgTable("categories", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    icon: text("icon"), // Icon name (e.g., "Racket", "Shoe", "Bag")
    image: text("image"),
    parent_id: uuid("parent_id"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// PRODUCTS TABLE
// ============================================
export const products = pgTable(
    "products",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        category_id: uuid("category_id").references(() => categories.id),
        title: text("title").notNull(),
        slug: text("slug").notNull().unique(),
        description: text("description"),
        brand: text("brand"),
        gender: genderEnum("gender").default("UNISEX").notNull(),
        price: decimal("price", { precision: 12, scale: 2 }).notNull(),
        condition: productConditionEnum("condition").default("PRELOVED").notNull(),
        condition_rating: integer("condition_rating"),
        condition_notes: text("condition_notes"),
        weight_grams: integer("weight_grams"),
        stock: integer("stock").default(1).notNull(),
        views: integer("views").default(0),
        status: productStatusEnum("status").default("DRAFT").notNull(),
        images: jsonb("images").$type<string[]>().default([]),
        bargain_enabled: boolean("bargain_enabled").default(false).notNull(),
        min_acceptable_price: decimal("min_acceptable_price", { precision: 12, scale: 2 }),
        max_offer_rounds: integer("max_offer_rounds").default(3).notNull(),
        auto_decline_below: decimal("auto_decline_below", { precision: 12, scale: 2 }),
        weight_class: text("weight_class"),
        balance: text("balance"),
        shaft_flex: text("shaft_flex"),
        grip_size: text("grip_size"),
        max_string_tension_lbs: integer("max_string_tension_lbs"),
        stiffness_rating: integer("stiffness_rating"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        slug_idx: uniqueIndex("idx_products_slug").on(table.slug),
        seller_id_idx: index("idx_products_seller_id").on(table.seller_id),
        category_id_idx: index("idx_products_category_id").on(table.category_id),
        status_idx: index("idx_products_status").on(table.status),
    })
);

// ============================================
// PRODUCT_VARIANTS TABLE
// ============================================
export const product_variants = pgTable(
    "product_variants",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        name: text("name").notNull(), // e.g., "4U G5", "Size 42", "Red"
        variant_type: text("variant_type").notNull(), // "size", "color", "grip_size", etc.
        sku: text("sku"),
        price: decimal("price", { precision: 12, scale: 2 }), // Override product price if set
        stock: integer("stock").default(1).notNull(),
        images: jsonb("images").$type<string[]>().default([]),
        is_available: boolean("is_available").default(true).notNull(),
        sort_order: integer("sort_order").default(0),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        product_id_idx: index("idx_product_variants_product_id").on(table.product_id),
    })
);

// ============================================
// ADDRESSES TABLE
// ============================================
export const addresses = pgTable("addresses", {
    id: uuid("id").defaultRandom().primaryKey(),
    user_id: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipient_name: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    province_id: integer("province_id"),
    city_id: integer("city_id"),
    district_id: integer("district_id"),
    full_address: text("full_address").notNull(),
    postal_code: text("postal_code"),
    latitude: decimal("latitude", { precision: 10, scale: 7 }),
    longitude: decimal("longitude", { precision: 10, scale: 7 }),
    is_default_shipping: boolean("is_default_shipping").default(false),
    is_default_pickup: boolean("is_default_pickup").default(false),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// CARTS TABLE
// ============================================
export const carts = pgTable(
    "carts",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        variant_id: uuid("variant_id").references(() => product_variants.id, { onDelete: "set null" }),
        quantity: integer("quantity").default(1).notNull(),
        saved_for_later: boolean("saved_for_later").default(false).notNull(),
        abandonment_state: text("abandonment_state"),
        last_mutated_at: timestamp("last_mutated_at").defaultNow().notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        user_product_variant_idx: uniqueIndex("idx_carts_user_product_variant").on(
            table.user_id,
            table.product_id,
            table.variant_id
        ),
    })
);

// ============================================
// WISHLISTS TABLE
// ============================================
export const wishlists = pgTable(
    "wishlists",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        user_product_idx: uniqueIndex("idx_wishlists_user_product").on(table.user_id, table.product_id),
    })
);

// ============================================
// REC-02: USER RECENTLY VIEWED PRODUCTS
// ============================================
export const user_recently_viewed = pgTable(
    "user_recently_viewed",
    {
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        viewed_at: timestamp("viewed_at").defaultNow().notNull(),
    },
    (table) => ({
        pk: uniqueIndex("user_recently_viewed_pkey").on(table.user_id, table.product_id),
        user_viewed_idx: index("idx_user_recently_viewed_at").on(table.user_id, table.viewed_at),
    })
);

// ============================================
// ALERT-01: WISHLIST PRICE BASELINES
// ============================================
export const wishlist_price_baselines = pgTable(
    "wishlist_price_baselines",
    {
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        baseline_price: decimal("baseline_price", { precision: 12, scale: 2 }).notNull(),
        baseline_stock: integer("baseline_stock").default(0).notNull(),
        last_alerted_at: timestamp("last_alerted_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        pk: uniqueIndex("wishlist_price_baselines_pkey").on(table.user_id, table.product_id),
    })
);

// ============================================
// ANLY-01: PRODUCT EVENTS (impression/click/cart/checkout/purchase)
// ============================================
export const product_events = pgTable(
    "product_events",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        user_id: text("user_id").references(() => users.id, { onDelete: "set null" }),
        session_id: text("session_id"),
        event_type: text("event_type").notNull(),
        source: text("source"),
        search_term: text("search_term"),
        referrer: text("referrer"),
        occurred_at: timestamp("occurred_at").defaultNow().notNull(),
        meta: jsonb("meta"),
    },
    (table) => ({
        product_type_time_idx: index("idx_product_events_product_type_time").on(
            table.product_id,
            table.event_type,
            table.occurred_at
        ),
        occurred_at_idx: index("idx_product_events_occurred_at").on(table.occurred_at),
    })
);

export const product_event_daily = pgTable(
    "product_event_daily",
    {
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        date: text("date").notNull(),
        event_type: text("event_type").notNull(),
        count: integer("count").default(0).notNull(),
    },
    (table) => ({
        pk: uniqueIndex("product_event_daily_pk").on(table.product_id, table.date, table.event_type),
        date_idx: index("idx_product_event_daily_date").on(table.date),
    })
);

export const seller_search_terms_daily = pgTable(
    "seller_search_terms_daily",
    {
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        date: text("date").notNull(),
        term: text("term").notNull(),
        click_count: integer("click_count").default(0).notNull(),
        impression_count: integer("impression_count").default(0).notNull(),
    },
    (table) => ({
        pk: uniqueIndex("seller_search_terms_daily_pk").on(table.seller_id, table.date, table.term),
        seller_date_idx: index("idx_seller_search_terms_seller_date").on(table.seller_id, table.date),
    })
);

export const seller_digest_log = pgTable("seller_digest_log", {
    seller_id: text("seller_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    last_sent_at: timestamp("last_sent_at"),
    last_period_start: text("last_period_start"),
    last_period_end: text("last_period_end"),
});

// ============================================
// ORDERS TABLE
// ============================================
export const orders = pgTable(
    "orders",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_number: text("order_number").notNull().unique(),
        buyer_id: text("buyer_id")
            .notNull()
            .references(() => users.id),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id),
        shipping_address_id: uuid("shipping_address_id").references(() => addresses.id),
        status: orderStatusEnum("status").default("PENDING_PAYMENT").notNull(),
        subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
        shipping_cost: decimal("shipping_cost", { precision: 12, scale: 2 }).default("0"),
        total: decimal("total", { precision: 12, scale: 2 }).notNull(),
        notes: text("notes"),
        // Shipping tracking fields
        tracking_number: text("tracking_number"),
        shipping_provider: text("shipping_provider"),
        shipping_quote_at: timestamp("shipping_quote_at"),
        shipped_at: timestamp("shipped_at"),
        estimated_delivery: timestamp("estimated_delivery"),
        release_due_at: timestamp("release_due_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        buyer_id_idx: index("idx_orders_buyer_id").on(table.buyer_id),
        seller_id_idx: index("idx_orders_seller_id").on(table.seller_id),
        status_idx: index("idx_orders_status").on(table.status),
        release_due_at_idx: index("idx_orders_release_due_at").on(table.release_due_at),
    })
);

// ============================================
// ORDER_ITEMS TABLE
// ============================================
export const order_items = pgTable("order_items", {
    id: uuid("id").defaultRandom().primaryKey(),
    order_id: uuid("order_id")
        .notNull()
        .references(() => orders.id, { onDelete: "cascade" }),
    product_id: uuid("product_id")
        .notNull()
        .references(() => products.id),
    variant_id: uuid("variant_id").references(() => product_variants.id, { onDelete: "set null" }),
    quantity: integer("quantity").default(1).notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    fee_rule_id: uuid("fee_rule_id"),
    resolved_fee_value: decimal("resolved_fee_value", { precision: 12, scale: 2 }).default("0").notNull(),
    resolved_fee_currency: text("resolved_fee_currency").default("IDR").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// NICHE-04: STRING SERVICE ORDERS
// ============================================
export const string_service_orders = pgTable("string_service_orders", {
    id: uuid("id").defaultRandom().primaryKey(),
    order_item_id: uuid("order_item_id").notNull(),
    string_brand: text("string_brand").notNull(),
    string_gauge: text("string_gauge"),
    tension_lbs: integer("tension_lbs").notNull(),
    service_fee: decimal("service_fee", { precision: 12, scale: 2 }).default("0").notNull(),
    status: text("status").default("PENDING").notNull(),
    completed_at: timestamp("completed_at"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============================================
// NICHE-05: PLAYER PROFILES
// ============================================
export const player_profiles = pgTable("player_profiles", {
    user_id: text("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    level: text("level"),
    play_style: text("play_style"),
    dominant_hand: text("dominant_hand"),
    preferred_weight_class: text("preferred_weight_class"),
    preferred_balance: text("preferred_balance"),
    preferred_shaft_flex: text("preferred_shaft_flex"),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================
// AFF-01..04: AFFILIATE
// ============================================
export const affiliateStatusEnum = pgEnum("affiliate_status", ["PENDING", "ACTIVE", "REJECTED", "SUSPENDED"]);
export const attributionStatusEnum = pgEnum("attribution_status", ["PENDING", "CLEARED", "REVERSED"]);

export const affiliate_accounts = pgTable("affiliate_accounts", {
    user_id: text("user_id")
        .primaryKey()
        .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    status: affiliateStatusEnum("status").default("PENDING").notNull(),
    commission_rate_override: decimal("commission_rate_override", { precision: 5, scale: 2 }),
    payout_method: text("payout_method"),
    payout_account: text("payout_account"),
    full_name: text("full_name"),
    nik: text("nik"),
    phone: text("phone"),
    instagram_handle: text("instagram_handle"),
    ktp_url: text("ktp_url"),
    statement_url: text("statement_url"),
    bank_name: text("bank_name"),
    bank_account_number: text("bank_account_number"),
    bank_account_name: text("bank_account_name"),
    review_notes: text("review_notes"),
    reviewed_at: timestamp("reviewed_at"),
    reviewer_id: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const affiliate_clicks = pgTable(
    "affiliate_clicks",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        code: text("code").notNull(),
        fingerprint: text("fingerprint"),
        referrer: text("referrer"),
        landing_url: text("landing_url"),
        ip: text("ip"),
        user_agent: text("user_agent"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        expires_at: timestamp("expires_at").notNull(),
    },
    (table) => ({
        code_idx: index("idx_affiliate_clicks_code").on(table.code),
    })
);

export const affiliate_attributions = pgTable(
    "affiliate_attributions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_id: uuid("order_id")
            .notNull()
            .unique()
            .references(() => orders.id, { onDelete: "cascade" }),
        affiliate_user_id: text("affiliate_user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        code: text("code").notNull(),
        computed_commission: decimal("computed_commission", { precision: 12, scale: 2 }).default("0").notNull(),
        rate_used: decimal("rate_used", { precision: 5, scale: 2 }).default("0").notNull(),
        status: attributionStatusEnum("status").default("PENDING").notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        decided_at: timestamp("decided_at"),
        memo: text("memo"),
    },
    (table) => ({
        affiliate_idx: index("idx_affiliate_attributions_affiliate").on(table.affiliate_user_id),
        status_idx: index("idx_affiliate_attributions_status").on(table.status),
    })
);

export const affiliateAccountsRelations = relations(affiliate_accounts, ({ one, many }) => ({
    user: one(users, {
        fields: [affiliate_accounts.user_id],
        references: [users.id],
        relationName: "affiliate_owner",
    }),
    reviewer: one(users, {
        fields: [affiliate_accounts.reviewer_id],
        references: [users.id],
        relationName: "affiliate_reviewer",
    }),
    attributions: many(affiliate_attributions),
}));

export const affiliateAttributionsRelations = relations(affiliate_attributions, ({ one }) => ({
    affiliate: one(users, {
        fields: [affiliate_attributions.affiliate_user_id],
        references: [users.id],
    }),
    order: one(orders, {
        fields: [affiliate_attributions.order_id],
        references: [orders.id],
    }),
}));

// ============================================
// BARG-01: OFFERS (bargaining)
// ============================================
export const offerStatusEnum = pgEnum("offer_status", [
    "PENDING",
    "ACCEPTED",
    "REJECTED",
    "COUNTERED",
    "EXPIRED",
    "WITHDRAWN",
]);

export const offers = pgTable(
    "offers",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        listing_id: uuid("listing_id")
            .notNull()
            .references(() => products.id, { onDelete: "cascade" }),
        variant_id: uuid("variant_id").references(() => product_variants.id, { onDelete: "set null" }),
        buyer_id: text("buyer_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
        status: offerStatusEnum("status").default("PENDING").notNull(),
        round: integer("round").default(1).notNull(),
        parent_offer_id: uuid("parent_offer_id"),
        actor_role: text("actor_role").notNull(),
        expires_at: timestamp("expires_at").notNull(),
        decided_at: timestamp("decided_at"),
        decided_by: text("decided_by").references(() => users.id, { onDelete: "set null" }),
        checkout_token: text("checkout_token").unique(),
        checkout_token_expires_at: timestamp("checkout_token_expires_at"),
        checkout_token_used_at: timestamp("checkout_token_used_at"),
        notes: text("notes"),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        listing_idx: index("idx_offers_listing").on(table.listing_id),
        buyer_status_idx: index("idx_offers_buyer_status").on(table.buyer_id, table.status),
        seller_status_idx: index("idx_offers_seller_status").on(table.seller_id, table.status),
        status_expires_idx: index("idx_offers_status_expires").on(table.status, table.expires_at),
    })
);

export const offersRelations = relations(offers, ({ one }) => ({
    listing: one(products, {
        fields: [offers.listing_id],
        references: [products.id],
    }),
    variant: one(product_variants, {
        fields: [offers.variant_id],
        references: [product_variants.id],
    }),
    buyer: one(users, {
        fields: [offers.buyer_id],
        references: [users.id],
        relationName: "offer_buyer",
    }),
    seller: one(users, {
        fields: [offers.seller_id],
        references: [users.id],
        relationName: "offer_seller",
    }),
}));

// ============================================
// MON-01: PLATFORM FEE RULES + BRACKETS
// ============================================
export const feeRuleModeEnum = pgEnum("fee_rule_mode", ["PERCENT", "FIXED", "TIERED"]);
export const feeValueModeEnum = pgEnum("fee_value_mode", ["PERCENT", "FIXED"]);

export const platform_fee_rules = pgTable("platform_fee_rules", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    scope_category_id: uuid("scope_category_id"),
    scope_seller_tier: text("scope_seller_tier"),
    valid_from: timestamp("valid_from").defaultNow().notNull(),
    valid_to: timestamp("valid_to"),
    priority: integer("priority").default(100).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    mode: feeRuleModeEnum("mode").default("PERCENT").notNull(),
    default_value: decimal("default_value", { precision: 12, scale: 4 }).default("0").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const platform_fee_rule_brackets = pgTable("platform_fee_rule_brackets", {
    id: uuid("id").defaultRandom().primaryKey(),
    rule_id: uuid("rule_id")
        .notNull()
        .references(() => platform_fee_rules.id, { onDelete: "cascade" }),
    min_price: decimal("min_price", { precision: 12, scale: 2 }).default("0").notNull(),
    max_price: decimal("max_price", { precision: 12, scale: 2 }),
    value: decimal("value", { precision: 12, scale: 4 }).notNull(),
    value_mode: feeValueModeEnum("value_mode").default("PERCENT").notNull(),
});

export const platformFeeRulesRelations = relations(platform_fee_rules, ({ many }) => ({
    brackets: many(platform_fee_rule_brackets),
}));

export const platformFeeRuleBracketsRelations = relations(platform_fee_rule_brackets, ({ one }) => ({
    rule: one(platform_fee_rules, {
        fields: [platform_fee_rule_brackets.rule_id],
        references: [platform_fee_rules.id],
    }),
}));

// ============================================
// MON-03: DOUBLE-ENTRY LEDGER
// ============================================
export const ledgerAccountTypeEnum = pgEnum("ledger_account_type", [
    "PLATFORM",
    "USER_WALLET",
    "ESCROW",
    "EXTERNAL",
]);

export const ledger_accounts = pgTable("ledger_accounts", {
    id: uuid("id").defaultRandom().primaryKey(),
    type: ledgerAccountTypeEnum("type").notNull(),
    owner_user_id: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    currency: text("currency").default("IDR").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const ledger_entries = pgTable("ledger_entries", {
    id: uuid("id").defaultRandom().primaryKey(),
    entry_group_id: uuid("entry_group_id").notNull(),
    account_id: uuid("account_id")
        .notNull()
        .references(() => ledger_accounts.id, { onDelete: "restrict" }),
    debit: decimal("debit", { precision: 14, scale: 2 }).default("0").notNull(),
    credit: decimal("credit", { precision: 14, scale: 2 }).default("0").notNull(),
    currency: text("currency").default("IDR").notNull(),
    ref_type: text("ref_type").notNull(),
    ref_id: text("ref_id").notNull(),
    memo: text("memo"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

export const ledgerAccountsRelations = relations(ledger_accounts, ({ many }) => ({
    entries: many(ledger_entries),
}));

export const ledgerEntriesRelations = relations(ledger_entries, ({ one }) => ({
    account: one(ledger_accounts, {
        fields: [ledger_entries.account_id],
        references: [ledger_accounts.id],
    }),
}));

// ============================================
// MON-04: VOUCHER ENGINE
// ============================================
export const voucherTypeEnum = pgEnum("voucher_type", ["PERCENT", "FIXED", "FREE_SHIPPING"]);

export const vouchers = pgTable("vouchers", {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    type: voucherTypeEnum("type").notNull(),
    value: decimal("value", { precision: 12, scale: 2 }).default("0").notNull(),
    max_uses: integer("max_uses"),
    max_uses_per_user: integer("max_uses_per_user").default(1).notNull(),
    valid_from: timestamp("valid_from").defaultNow().notNull(),
    valid_to: timestamp("valid_to"),
    min_order_amount: decimal("min_order_amount", { precision: 12, scale: 2 }),
    scope: jsonb("scope"),
    is_active: boolean("is_active").default(true).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const voucher_redemptions = pgTable("voucher_redemptions", {
    id: uuid("id").defaultRandom().primaryKey(),
    voucher_id: uuid("voucher_id")
        .notNull()
        .references(() => vouchers.id, { onDelete: "cascade" }),
    user_id: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    order_id: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    applied_amount: decimal("applied_amount", { precision: 12, scale: 2 }).notNull(),
    redeemed_at: timestamp("redeemed_at").defaultNow().notNull(),
});

export const vouchersRelations = relations(vouchers, ({ many }) => ({
    redemptions: many(voucher_redemptions),
}));

export const voucherRedemptionsRelations = relations(voucher_redemptions, ({ one }) => ({
    voucher: one(vouchers, {
        fields: [voucher_redemptions.voucher_id],
        references: [vouchers.id],
    }),
    user: one(users, {
        fields: [voucher_redemptions.user_id],
        references: [users.id],
    }),
}));

// ============================================
// CONVERSATIONS TABLE
// ============================================
export const conversations = pgTable(
    "conversations",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        buyer_id: text("buyer_id")
            .notNull()
            .references(() => users.id),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id),
        product_id: uuid("product_id").references(() => products.id),
        last_message_at: timestamp("last_message_at").defaultNow().notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        buyer_seller_product_idx: uniqueIndex("idx_conversations_buyer_seller_product").on(
            table.buyer_id,
            table.seller_id,
            table.product_id
        ),
    })
);

// ============================================
// MESSAGES TABLE
// ============================================
export const messages = pgTable(
    "messages",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        conversation_id: uuid("conversation_id")
            .notNull()
            .references(() => conversations.id, { onDelete: "cascade" }),
        sender_id: text("sender_id")
            .notNull()
            .references(() => users.id),
        content: text("content"),
        attachment_url: text("attachment_url"),
        product_reference_id: uuid("product_reference_id").references(() => products.id),
        is_read: boolean("is_read").default(false).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        conversation_id_idx: index("idx_messages_conversation_id").on(table.conversation_id),
    })
);

// ============================================
// RELATIONS
// ============================================
export const usersRelations = relations(users, ({ one, many }) => ({
    products: many(products),
    addresses: many(addresses),
    carts: many(carts),
    wishlists: many(wishlists),
    orders_as_buyer: many(orders, { relationName: "buyer_orders" }),
    orders_as_seller: many(orders, { relationName: "seller_orders" }),
    sessions: many(sessions),
    accounts: many(accounts),
    sellerKyc: one(seller_kyc, {
        fields: [users.id],
        references: [seller_kyc.user_id],
        relationName: "seller_kyc_profile",
    }),
    reviewedSellerKyc: many(seller_kyc, { relationName: "seller_kyc_reviewer" }),
    affiliateAccount: one(affiliate_accounts, {
        fields: [users.id],
        references: [affiliate_accounts.user_id],
        relationName: "affiliate_owner",
    }),
    reviewedAffiliates: many(affiliate_accounts, { relationName: "affiliate_reviewer" }),
    storeReviewer: one(users, {
        fields: [users.store_reviewer_id],
        references: [users.id],
        relationName: "store_reviewer",
    }),
    reviewedStores: many(users, { relationName: "store_reviewer" }),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
    seller: one(users, {
        fields: [products.seller_id],
        references: [users.id],
    }),
    category: one(categories, {
        fields: [products.category_id],
        references: [categories.id],
    }),
    variants: many(product_variants),
    cart_items: many(carts),
    wishlist_items: many(wishlists),
    order_items: many(order_items),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
    buyer: one(users, {
        fields: [orders.buyer_id],
        references: [users.id],
        relationName: "buyer_orders",
    }),
    seller: one(users, {
        fields: [orders.seller_id],
        references: [users.id],
        relationName: "seller_orders",
    }),
    shipping_address: one(addresses, {
        fields: [orders.shipping_address_id],
        references: [addresses.id],
    }),
    items: many(order_items),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    buyer: one(users, {
        fields: [conversations.buyer_id],
        references: [users.id],
    }),
    seller: one(users, {
        fields: [conversations.seller_id],
        references: [users.id],
    }),
    product: one(products, {
        fields: [conversations.product_id],
        references: [products.id],
    }),
    messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
    conversation: one(conversations, {
        fields: [messages.conversation_id],
        references: [conversations.id],
    }),
    sender: one(users, {
        fields: [messages.sender_id],
        references: [users.id],
    }),
}));

export const cartsRelations = relations(carts, ({ one }) => ({
    user: one(users, {
        fields: [carts.user_id],
        references: [users.id],
    }),
    product: one(products, {
        fields: [carts.product_id],
        references: [products.id],
    }),
    variant: one(product_variants, {
        fields: [carts.variant_id],
        references: [product_variants.id],
    }),
}));

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
    user: one(users, {
        fields: [wishlists.user_id],
        references: [users.id],
    }),
    product: one(products, {
        fields: [wishlists.product_id],
        references: [products.id],
    }),
}));

export const orderItemsRelations = relations(order_items, ({ one }) => ({
    order: one(orders, {
        fields: [order_items.order_id],
        references: [orders.id],
    }),
    product: one(products, {
        fields: [order_items.product_id],
        references: [products.id],
    }),
    variant: one(product_variants, {
        fields: [order_items.variant_id],
        references: [product_variants.id],
    }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
    user: one(users, {
        fields: [addresses.user_id],
        references: [users.id],
    }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.user_id],
        references: [users.id],
    }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.user_id],
        references: [users.id],
    }),
}));

// ============================================
// PAYMENTS TABLE
// ============================================
export const payments = pgTable(
    "payments",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_id: uuid("order_id")
            .notNull()
            .references(() => orders.id, { onDelete: "cascade" }),
        xendit_invoice_id: text("xendit_invoice_id"),
        xendit_invoice_url: text("xendit_invoice_url"),
        amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
        status: paymentStatusEnum("status").default("PENDING").notNull(),
        payment_method: text("payment_method"),
        paid_at: timestamp("paid_at"),
        expires_at: timestamp("expires_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        order_id_idx: index("idx_payments_order_id").on(table.order_id),
        xendit_invoice_idx: index("idx_payments_xendit_invoice").on(table.xendit_invoice_id),
    })
);

// ============================================
// NOTIFICATIONS TABLE
// ============================================
export const notifications = pgTable(
    "notifications",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: notificationTypeEnum("type").notNull(),
        title: text("title").notNull(),
        message: text("message").notNull(),
        idempotency_key: text("idempotency_key"),
        data: jsonb("data"), // Additional data like order_id, product_id, etc.
        read: boolean("read").default(false).notNull(),
        read_at: timestamp("read_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        user_id_idx: index("idx_notifications_user_id").on(table.user_id),
        user_read_idx: index("idx_notifications_user_read").on(table.user_id, table.read),
        idempotency_idx: uniqueIndex("idx_notifications_idempotency_key").on(table.idempotency_key),
    })
);

// ============================================
// REVIEWS TABLE
// ============================================
export const reviews = pgTable(
    "reviews",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_item_id: uuid("order_item_id")
            .notNull()
            .references(() => order_items.id, { onDelete: "cascade" }),
        buyer_id: text("buyer_id")
            .notNull()
            .references(() => users.id),
        product_id: uuid("product_id")
            .notNull()
            .references(() => products.id),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id),
        rating: integer("rating").notNull(), // 1-5
        comment: text("comment"),
        images: jsonb("images").$type<string[]>().default([]),
        seller_reply: text("seller_reply"),
        seller_reply_at: timestamp("seller_reply_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        product_id_idx: index("idx_reviews_product_id").on(table.product_id),
        seller_id_idx: index("idx_reviews_seller_id").on(table.seller_id),
        order_item_idx: uniqueIndex("idx_reviews_order_item").on(table.order_item_id),
    })
);

// ============================================
// DISPUTES TABLE
// ============================================
export const disputeTypeEnum = pgEnum("dispute_type", [
    "ITEM_NOT_AS_DESCRIBED",
    "ITEM_NOT_RECEIVED",
    "REFUND_REQUEST",
    "SELLER_NOT_RESPONSIVE",
    "OTHER",
]);

export const disputePriorityEnum = pgEnum("dispute_priority", [
    "LOW",
    "NORMAL",
    "HIGH",
    "URGENT",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
    "OPEN",
    "IN_PROGRESS",
    "AWAITING_RESPONSE",
    "RESOLVED",
    "CLOSED",
]);

export const disputes = pgTable(
    "disputes",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        order_id: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
        reporter_id: text("reporter_id")
            .notNull()
            .references(() => users.id),
        reported_id: text("reported_id")
            .notNull()
            .references(() => users.id),
        dispute_number: text("dispute_number").notNull().unique(),
        type: disputeTypeEnum("type").notNull(),
        priority: disputePriorityEnum("priority").default("NORMAL").notNull(),
        status: disputeStatusEnum("status").default("OPEN").notNull(),
        title: text("title").notNull(),
        description: text("description"),
        amount: decimal("amount", { precision: 12, scale: 2 }),
        evidence_images: jsonb("evidence_images").$type<string[]>().default([]),
        resolution: text("resolution"),
        resolved_at: timestamp("resolved_at"),
        resolved_by: text("resolved_by"),
        response_due_at: timestamp("response_due_at"),
        resolution_due_at: timestamp("resolution_due_at"),
        escalation_count: integer("escalation_count").default(0).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        order_id_idx: index("idx_disputes_order_id").on(table.order_id),
        reporter_id_idx: index("idx_disputes_reporter_id").on(table.reporter_id),
        status_idx: index("idx_disputes_status").on(table.status),
        response_due_at_idx: index("idx_disputes_response_due_at").on(table.response_due_at),
        resolution_due_at_idx: index("idx_disputes_resolution_due_at").on(table.resolution_due_at),
    })
);

// ============================================
// SUPPORT TICKETS TABLE
// ============================================
export const ticketCategoryEnum = pgEnum("ticket_category", [
    "ACCOUNT",
    "PAYMENT",
    "SHIPPING",
    "VERIFICATION",
    "SECURITY",
    "TECHNICAL",
    "OTHER",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
    "OPEN",
    "PENDING",
    "IN_PROGRESS",
    "CLOSED",
]);

export const support_tickets = pgTable(
    "support_tickets",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        ticket_number: text("ticket_number").notNull().unique(),
        category: ticketCategoryEnum("category").notNull(),
        status: ticketStatusEnum("status").default("OPEN").notNull(),
        priority: disputePriorityEnum("priority").default("NORMAL").notNull(),
        subject: text("subject").notNull(),
        assigned_to: text("assigned_to"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        user_id_idx: index("idx_support_tickets_user_id").on(table.user_id),
        status_idx: index("idx_support_tickets_status").on(table.status),
    })
);

export const support_messages = pgTable(
    "support_messages",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        ticket_id: uuid("ticket_id")
            .notNull()
            .references(() => support_tickets.id, { onDelete: "cascade" }),
        sender_id: text("sender_id").references(() => users.id),
        is_admin: boolean("is_admin").default(false).notNull(),
        message: text("message").notNull(),
        attachments: jsonb("attachments").$type<string[]>().default([]),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        ticket_id_idx: index("idx_support_messages_ticket_id").on(table.ticket_id),
    })
);

// ============================================
// NEW RELATIONS
// ============================================
export const paymentsRelations = relations(payments, ({ one }) => ({
    order: one(orders, {
        fields: [payments.order_id],
        references: [orders.id],
    }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.user_id],
        references: [users.id],
    }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
    order_item: one(order_items, {
        fields: [reviews.order_item_id],
        references: [order_items.id],
    }),
    buyer: one(users, {
        fields: [reviews.buyer_id],
        references: [users.id],
        relationName: "buyer_reviews",
    }),
    product: one(products, {
        fields: [reviews.product_id],
        references: [products.id],
    }),
    seller: one(users, {
        fields: [reviews.seller_id],
        references: [users.id],
        relationName: "seller_reviews",
    }),
}));

export const productVariantsRelations = relations(product_variants, ({ one, many }) => ({
    product: one(products, {
        fields: [product_variants.product_id],
        references: [products.id],
    }),
    cart_items: many(carts),
    order_items: many(order_items),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
    order: one(orders, {
        fields: [disputes.order_id],
        references: [orders.id],
    }),
    reporter: one(users, {
        fields: [disputes.reporter_id],
        references: [users.id],
        relationName: "disputes_reported",
    }),
    reported: one(users, {
        fields: [disputes.reported_id],
        references: [users.id],
        relationName: "disputes_against",
    }),
}));

export const supportTicketsRelations = relations(support_tickets, ({ one, many }) => ({
    user: one(users, {
        fields: [support_tickets.user_id],
        references: [users.id],
    }),
    messages: many(support_messages),
}));

export const supportMessagesRelations = relations(support_messages, ({ one }) => ({
    ticket: one(support_tickets, {
        fields: [support_messages.ticket_id],
        references: [support_tickets.id],
    }),
    sender: one(users, {
        fields: [support_messages.sender_id],
        references: [users.id],
    }),
}));

// ============================================
// INTEGRATION SETTINGS TABLE
// ============================================
export const integration_settings = pgTable(
    "integration_settings",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        key: text("key").notNull().unique(), // e.g. "xendit", "smtp", "rajaongkir"
        name: text("name").notNull(), // Display name
        description: text("description"), // Description of the integration
        category: text("category").notNull(), // "payment", "email", "shipping"
        enabled: boolean("enabled").default(false).notNull(),
        credentials: jsonb("credentials").$type<Record<string, string>>(), // API keys, secrets (should be encrypted in production)
        config: jsonb("config").$type<Record<string, unknown>>(), // Additional configuration
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        key_idx: uniqueIndex("idx_integration_settings_key").on(table.key),
        category_idx: index("idx_integration_settings_category").on(table.category),
    })
);

// ============================================
// FILES TABLE (Asset Management)
// ============================================
export const storageTypeEnum = pgEnum("storage_type", ["local", "s3"]);
export const fileTypeEnum = pgEnum("file_type", ["image", "video", "audio", "document", "other"]);

export const files = pgTable(
    "files",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        filename: text("filename").notNull(), // Stored filename (unique)
        original_name: text("original_name").notNull(), // Original upload name
        mime_type: text("mime_type").notNull(),
        file_type: fileTypeEnum("file_type").notNull(), // Derived category
        size: integer("size").notNull(), // Bytes
        storage_type: storageTypeEnum("storage_type").notNull(),
        storage_key: text("storage_key").notNull(), // Path or S3 key
        folder: text("folder").default("general"),
        tags: text("tags").array(),
        alt_text: text("alt_text"), // For images
        // CACHE-03: per-size variants populated by image-resize worker.
        // Shape: { thumb: "...", card: "...", pdp: "...", zoom: "..." }
        variants: jsonb("variants").$type<Record<string, string>>(),
        is_public: boolean("is_public").default(false).notNull(),
        uploaded_by: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        folder_idx: index("idx_files_folder").on(table.folder),
        file_type_idx: index("idx_files_file_type").on(table.file_type),
        uploaded_by_idx: index("idx_files_uploaded_by").on(table.uploaded_by),
    })
);

export const filesRelations = relations(files, ({ one }) => ({
    uploader: one(users, {
        fields: [files.uploaded_by],
        references: [users.id],
    }),
}));

// ============================================
// SELLER KYC TABLE
// ============================================
export const seller_kyc = pgTable(
    "seller_kyc",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        user_id: text("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        tier: sellerTierEnum("tier").default("T0").notNull(),
        status: kycStatusEnum("status").default("NOT_SUBMITTED").notNull(),
        ktp_file_id: uuid("ktp_file_id").references(() => files.id, { onDelete: "set null" }),
        selfie_file_id: uuid("selfie_file_id").references(() => files.id, { onDelete: "set null" }),
        business_doc_file_id: uuid("business_doc_file_id").references(() => files.id, { onDelete: "set null" }),
        submitted_at: timestamp("submitted_at"),
        reviewed_at: timestamp("reviewed_at"),
        reviewer_id: text("reviewer_id").references(() => users.id, { onDelete: "set null" }),
        notes: text("notes"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        user_id_idx: uniqueIndex("idx_seller_kyc_user_id").on(table.user_id),
        tier_idx: index("idx_seller_kyc_tier").on(table.tier),
        status_idx: index("idx_seller_kyc_status").on(table.status),
    })
);

export const sellerKycRelations = relations(seller_kyc, ({ one }) => ({
    seller: one(users, {
        fields: [seller_kyc.user_id],
        references: [users.id],
        relationName: "seller_kyc_profile",
    }),
    reviewer: one(users, {
        fields: [seller_kyc.reviewer_id],
        references: [users.id],
        relationName: "seller_kyc_reviewer",
    }),
    ktpFile: one(files, {
        fields: [seller_kyc.ktp_file_id],
        references: [files.id],
        relationName: "seller_kyc_ktp_file",
    }),
    selfieFile: one(files, {
        fields: [seller_kyc.selfie_file_id],
        references: [files.id],
        relationName: "seller_kyc_selfie_file",
    }),
    businessDocFile: one(files, {
        fields: [seller_kyc.business_doc_file_id],
        references: [files.id],
        relationName: "seller_kyc_business_doc_file",
    }),
}));

// ============================================
// FOLLOWS TABLE (Store Followers)
// ============================================
export const follows = pgTable(
    "follows",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        follower_id: text("follower_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        following_id: text("following_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        follower_idx: index("idx_follows_follower").on(table.follower_id),
        following_idx: index("idx_follows_following").on(table.following_id),
        unique_follow: uniqueIndex("idx_follows_unique").on(table.follower_id, table.following_id),
    })
);

export const followsRelations = relations(follows, ({ one }) => ({
    follower: one(users, {
        fields: [follows.follower_id],
        references: [users.id],
        relationName: "follower",
    }),
    following: one(users, {
        fields: [follows.following_id],
        references: [users.id],
        relationName: "following",
    }),
}));

// ============================================
// Accounting / GL (Phase 1) — see schema-accounting.ts
// ============================================
export * from "./schema-accounting";
