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

