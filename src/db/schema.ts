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
export const storeStatusEnum = pgEnum("store_status", ["ACTIVE", "VACATION", "BANNED"]);
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
    "NEW_MESSAGE",
    "NEW_REVIEW",
    "REVIEW_REPLY",
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
        role: userRoleEnum("role").default("USER").notNull(),
        // Seller-specific fields
        store_name: text("store_name"),
        store_slug: text("store_slug").unique(),
        store_description: text("store_description"),
        store_status: storeStatusEnum("store_status").default("ACTIVE"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        email_idx: uniqueIndex("idx_users_email").on(table.email),
        store_slug_idx: uniqueIndex("idx_users_store_slug").on(table.store_slug),
    })
);

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
        quantity: integer("quantity").default(1).notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        user_product_idx: uniqueIndex("idx_carts_user_product").on(table.user_id, table.product_id),
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
        shipped_at: timestamp("shipped_at"),
        estimated_delivery: timestamp("estimated_delivery"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        buyer_id_idx: index("idx_orders_buyer_id").on(table.buyer_id),
        seller_id_idx: index("idx_orders_seller_id").on(table.seller_id),
        status_idx: index("idx_orders_status").on(table.status),
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
    quantity: integer("quantity").default(1).notNull(),
    price: decimal("price", { precision: 12, scale: 2 }).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

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
export const usersRelations = relations(users, ({ many }) => ({
    products: many(products),
    addresses: many(addresses),
    carts: many(carts),
    wishlists: many(wishlists),
    orders_as_buyer: many(orders, { relationName: "buyer_orders" }),
    orders_as_seller: many(orders, { relationName: "seller_orders" }),
    sessions: many(sessions),
    accounts: many(accounts),
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
        data: jsonb("data"), // Additional data like order_id, product_id, etc.
        read: boolean("read").default(false).notNull(),
        read_at: timestamp("read_at"),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => ({
        user_id_idx: index("idx_notifications_user_id").on(table.user_id),
        user_read_idx: index("idx_notifications_user_read").on(table.user_id, table.read),
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
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => ({
        order_id_idx: index("idx_disputes_order_id").on(table.order_id),
        reporter_id_idx: index("idx_disputes_reporter_id").on(table.reporter_id),
        status_idx: index("idx_disputes_status").on(table.status),
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

export const productVariantsRelations = relations(product_variants, ({ one }) => ({
    product: one(products, {
        fields: [product_variants.product_id],
        references: [products.id],
    }),
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
