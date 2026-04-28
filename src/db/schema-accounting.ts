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
    numeric,
    date,
    index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";

// ============================================================
// Accounting / GL — Phase 1 schema (PSAK-compliant)
// Mirrors web/drizzle/0019_accounting_general_ledger.sql
// ============================================================

export const accountClassEnum = pgEnum("account_class", [
    "ASSET",
    "LIABILITY",
    "EQUITY",
    "REVENUE",
    "CONTRA_REVENUE",
    "COGS",
    "OPEX",
    "OTHER_INCOME",
    "OTHER_EXPENSE",
    "TAX_EXPENSE",
]);

export const accountNormalBalanceEnum = pgEnum("account_normal_balance", [
    "DEBIT",
    "CREDIT",
]);

export const ledgerBookEnum = pgEnum("ledger_book", ["PLATFORM", "SELLER"]);

export const journalStatusEnum = pgEnum("journal_status", [
    "DRAFT",
    "POSTED",
    "REVERSED",
    "VOIDED",
]);

export const journalSourceEnum = pgEnum("journal_source", [
    "AUTO_ORDER",
    "AUTO_PAYMENT",
    "AUTO_REFUND",
    "AUTO_PAYOUT",
    "AUTO_FEE",
    "AUTO_TAX",
    "AUTO_AFFILIATE",
    "AUTO_ADJUST_PERIOD",
    "MANUAL",
    "IMPORT",
]);

export const taxKindEnum = pgEnum("tax_kind", [
    "PPN_OUT",
    "PPN_IN",
    "PPH_21",
    "PPH_23",
    "PPH_4_2",
    "PPH_FINAL_UMKM",
    "PPH_25",
    "PPH_29",
    "PPN_PMSE",
]);

export const periodStatusEnum = pgEnum("period_status", [
    "OPEN",
    "LOCKED",
    "CLOSED",
]);

export const salesRegisterEventEnum = pgEnum("sales_register_event", [
    "SALE",
    "REFUND",
    "ADJUSTMENT",
]);

export const saleKindEnum = pgEnum("sale_kind", ["AGENT_3P", "PRINCIPAL_1P"]);

// ----- coa_accounts -----
export const coa_accounts = pgTable(
    "coa_accounts",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        code: text("code").notNull(),
        name: text("name").notNull(),
        class: accountClassEnum("class").notNull(),
        normal_balance: accountNormalBalanceEnum("normal_balance").notNull(),
        parent_id: uuid("parent_id"),
        is_postable: boolean("is_postable").default(true).notNull(),
        currency: text("currency").default("IDR").notNull(),
        book: ledgerBookEnum("book").default("PLATFORM").notNull(),
        tax_kind: taxKindEnum("tax_kind"),
        is_active: boolean("is_active").default(true).notNull(),
        description: text("description"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => ({
        class_idx: index("idx_coa_class").on(t.class),
        parent_idx: index("idx_coa_parent").on(t.parent_id),
    })
);

// ----- accounting_periods -----
export const accounting_periods = pgTable(
    "accounting_periods",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        book: ledgerBookEnum("book").default("PLATFORM").notNull(),
        year: integer("year").notNull(),
        month: integer("month").notNull(),
        starts_at: date("starts_at").notNull(),
        ends_at: date("ends_at").notNull(),
        status: periodStatusEnum("status").default("OPEN").notNull(),
        locked_at: timestamp("locked_at"),
        locked_by: text("locked_by").references(() => users.id, { onDelete: "set null" }),
        closed_at: timestamp("closed_at"),
        closed_by: text("closed_by").references(() => users.id, { onDelete: "set null" }),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        book_status_idx: index("idx_periods_book_status").on(t.book, t.status),
    })
);

// ----- journals -----
export const journals = pgTable(
    "journals",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        book: ledgerBookEnum("book").default("PLATFORM").notNull(),
        book_owner_id: text("book_owner_id").references(() => users.id, {
            onDelete: "restrict",
        }),
        period_id: uuid("period_id")
            .notNull()
            .references(() => accounting_periods.id, { onDelete: "restrict" }),
        journal_no: text("journal_no").notNull(),
        posted_at: timestamp("posted_at").defaultNow().notNull(),
        source: journalSourceEnum("source").notNull(),
        description: text("description").notNull(),
        ref_type: text("ref_type"),
        ref_id: text("ref_id"),
        status: journalStatusEnum("status").default("POSTED").notNull(),
        reverses_journal_id: uuid("reverses_journal_id"),
        idempotency_key: text("idempotency_key").unique(),
        hash_prev: text("hash_prev"),
        hash_self: text("hash_self"),
        created_by: text("created_by").references(() => users.id, { onDelete: "set null" }),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        period_idx: index("idx_journals_period").on(t.book, t.period_id),
        ref_idx: index("idx_journals_ref").on(t.ref_type, t.ref_id),
        posted_idx: index("idx_journals_posted").on(t.posted_at),
        owner_idx: index("idx_journals_owner").on(t.book, t.book_owner_id),
    })
);

// ----- journal_lines -----
export const journal_lines = pgTable(
    "journal_lines",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        journal_id: uuid("journal_id")
            .notNull()
            .references(() => journals.id, { onDelete: "cascade" }),
        line_no: integer("line_no").notNull(),
        account_id: uuid("account_id")
            .notNull()
            .references(() => coa_accounts.id, { onDelete: "restrict" }),
        debit: numeric("debit", { precision: 18, scale: 2 }).default("0").notNull(),
        credit: numeric("credit", { precision: 18, scale: 2 }).default("0").notNull(),
        currency: text("currency").default("IDR").notNull(),
        memo: text("memo"),
        partner_user_id: text("partner_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        partner_role: text("partner_role"), // 'SELLER'|'AFFILIATE'|'BUYER'
        tax_kind: taxKindEnum("tax_kind"),
        tax_base: numeric("tax_base", { precision: 18, scale: 2 }),
        tax_rate: numeric("tax_rate", { precision: 6, scale: 4 }),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        account_idx: index("idx_jl_account").on(t.account_id),
        partner_idx: index("idx_jl_partner").on(t.partner_user_id, t.partner_role),
        journal_idx: index("idx_jl_journal").on(t.journal_id, t.line_no),
        tax_idx: index("idx_jl_tax").on(t.tax_kind),
    })
);

// ----- tax_profiles -----
export const tax_profiles = pgTable("tax_profiles", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    kind: taxKindEnum("kind").notNull(),
    rate: numeric("rate", { precision: 6, scale: 4 }).notNull(),
    account_id: uuid("account_id").references(() => coa_accounts.id, {
        onDelete: "restrict",
    }),
    valid_from: date("valid_from").defaultNow().notNull(),
    valid_to: date("valid_to"),
    is_active: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ----- tax_documents -----
export const tax_documents = pgTable("tax_documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: taxKindEnum("kind").notNull(),
    number: text("number"),
    date: date("date").notNull(),
    partner_user_id: text("partner_user_id").references(() => users.id, {
        onDelete: "set null",
    }),
    partner_npwp: text("partner_npwp"),
    partner_name: text("partner_name"),
    dpp: numeric("dpp", { precision: 18, scale: 2 }).default("0").notNull(),
    tax_amount: numeric("tax_amount", { precision: 18, scale: 2 }).default("0").notNull(),
    journal_id: uuid("journal_id").references(() => journals.id, { onDelete: "set null" }),
    pdf_url: text("pdf_url"),
    status: text("status").default("DRAFT").notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ----- bank_accounts -----
export const bank_accounts = pgTable("bank_accounts", {
    id: uuid("id").defaultRandom().primaryKey(),
    coa_account_id: uuid("coa_account_id")
        .notNull()
        .references(() => coa_accounts.id, { onDelete: "restrict" }),
    bank_name: text("bank_name").notNull(),
    account_no: text("account_no").notNull(),
    account_holder: text("account_holder").notNull(),
    is_escrow: boolean("is_escrow").default(false).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    currency: text("currency").default("IDR").notNull(),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ----- bank_statement_lines -----
export const bank_statement_lines = pgTable("bank_statement_lines", {
    id: uuid("id").defaultRandom().primaryKey(),
    bank_account_id: uuid("bank_account_id")
        .notNull()
        .references(() => bank_accounts.id, { onDelete: "cascade" }),
    statement_date: date("statement_date").notNull(),
    description: text("description"),
    debit: numeric("debit", { precision: 18, scale: 2 }).default("0").notNull(),
    credit: numeric("credit", { precision: 18, scale: 2 }).default("0").notNull(),
    balance: numeric("balance", { precision: 18, scale: 2 }),
    matched_journal_line_id: uuid("matched_journal_line_id").references(
        () => journal_lines.id,
        { onDelete: "set null" }
    ),
    imported_batch_id: uuid("imported_batch_id"),
    created_at: timestamp("created_at").defaultNow().notNull(),
});

// ----- sales_register (sub-ledger SKU-level) -----
export const sales_register = pgTable(
    "sales_register",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        journal_id: uuid("journal_id").references(() => journals.id, { onDelete: "set null" }),
        order_id: uuid("order_id").notNull(),
        order_item_id: uuid("order_item_id").notNull(),
        event: salesRegisterEventEnum("event").notNull(),
        event_at: timestamp("event_at").defaultNow().notNull(),
        seller_id: text("seller_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        buyer_id: text("buyer_id").references(() => users.id, { onDelete: "set null" }),
        product_id: uuid("product_id"),
        variant_id: uuid("variant_id"),
        sku: text("sku"),
        category_id: uuid("category_id"),
        qty: numeric("qty", { precision: 18, scale: 4 }).default("1").notNull(),
        unit_price: numeric("unit_price", { precision: 18, scale: 2 }).default("0").notNull(),
        gross: numeric("gross", { precision: 18, scale: 2 }).default("0").notNull(),
        discount: numeric("discount", { precision: 18, scale: 2 }).default("0").notNull(),
        shipping: numeric("shipping", { precision: 18, scale: 2 }).default("0").notNull(),
        platform_fee: numeric("platform_fee", { precision: 18, scale: 2 }).default("0").notNull(),
        fee_dpp: numeric("fee_dpp", { precision: 18, scale: 2 }).default("0").notNull(),
        fee_ppn: numeric("fee_ppn", { precision: 18, scale: 2 }).default("0").notNull(),
        seller_net: numeric("seller_net", { precision: 18, scale: 2 }).default("0").notNull(),
        affiliate_user_id: text("affiliate_user_id").references(() => users.id, {
            onDelete: "set null",
        }),
        affiliate_commission: numeric("affiliate_commission", {
            precision: 18,
            scale: 2,
        }).default("0").notNull(),
        sale_kind: saleKindEnum("sale_kind").default("AGENT_3P").notNull(),
        currency: text("currency").default("IDR").notNull(),
        posted_at: timestamp("posted_at").defaultNow().notNull(),
    },
    (t) => ({
        seller_time_idx: index("idx_sr_seller_time").on(t.seller_id, t.event_at),
        category_time_idx: index("idx_sr_category_time").on(t.category_id, t.event_at),
        product_time_idx: index("idx_sr_product_time").on(t.product_id, t.event_at),
        journal_idx: index("idx_sr_journal").on(t.journal_id),
        kind_time_idx: index("idx_sr_kind_time").on(t.sale_kind, t.event_at),
        affiliate_idx: index("idx_sr_affiliate").on(t.affiliate_user_id),
    })
);

// ----- accounting_settings -----
export const accounting_settings = pgTable(
    "accounting_settings",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        key: text("key").notNull(),
        value: jsonb("value").notNull(),
        scope: text("scope").default("GLOBAL").notNull(),
        effective_from: date("effective_from").defaultNow().notNull(),
        effective_to: date("effective_to"),
        is_active: boolean("is_active").default(true).notNull(),
        notes: text("notes"),
        updated_by: text("updated_by").references(() => users.id, { onDelete: "set null" }),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
        created_at: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        key_scope_eff_idx: index("idx_acc_settings_key_scope_eff").on(
            t.key,
            t.scope,
            t.effective_from
        ),
    })
);

// ============================================================
// Phase 8 — 1P Inventory + COGS (sub-ledger)
// Mirrors web/drizzle/0020_inventory_cogs.sql
// ============================================================

export const inventoryMovementKindEnum = pgEnum("inventory_movement_kind", [
    "RECEIPT",     // Pembelian / penerimaan barang dari vendor
    "ADJUSTMENT",  // Stock opname positif/negatif
    "ISSUE",       // Pengeluaran karena penjualan (HPP) atau loss
    "RETURN_IN",   // Retur dari customer (kembali ke gudang)
    "RETURN_OUT",  // Retur ke vendor
]);

export const inventoryCostMethodEnum = pgEnum("inventory_cost_method", [
    "MOVING_AVG",
    "FIFO",
]);

// Master item (1P SKU) — independent from marketplace `products` table because 1P stock
// can pre-exist before product listing and may include components/raw materials.
export const inventory_items = pgTable(
    "inventory_items",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        sku: text("sku").notNull(),
        name: text("name").notNull(),
        product_id: uuid("product_id"), // optional FK to marketplace products (set when listed)
        cost_method: inventoryCostMethodEnum("cost_method").default("MOVING_AVG").notNull(),
        unit: text("unit").default("PCS").notNull(),
        // Real-time aggregate cache (recomputed on every movement)
        on_hand_qty: numeric("on_hand_qty", { precision: 18, scale: 4 }).default("0").notNull(),
        avg_unit_cost: numeric("avg_unit_cost", { precision: 18, scale: 4 }).default("0").notNull(),
        on_hand_value: numeric("on_hand_value", { precision: 18, scale: 2 }).default("0").notNull(),
        is_active: boolean("is_active").default(true).notNull(),
        notes: text("notes"),
        created_at: timestamp("created_at").defaultNow().notNull(),
        updated_at: timestamp("updated_at").defaultNow().notNull(),
    },
    (t) => ({
        sku_idx: index("idx_inv_items_sku").on(t.sku),
        product_idx: index("idx_inv_items_product").on(t.product_id),
    })
);

// Movements log — append-only, every change posts a paired GL journal.
export const inventory_movements = pgTable(
    "inventory_movements",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        item_id: uuid("item_id")
            .notNull()
            .references(() => inventory_items.id, { onDelete: "restrict" }),
        kind: inventoryMovementKindEnum("kind").notNull(),
        qty: numeric("qty", { precision: 18, scale: 4 }).notNull(), // signed: + receipt/return_in/adj+, - issue/return_out/adj-
        unit_cost: numeric("unit_cost", { precision: 18, scale: 4 }).notNull(),
        total_cost: numeric("total_cost", { precision: 18, scale: 2 }).notNull(), // qty * unit_cost (signed)
        ref_type: text("ref_type"), // e.g. 'PURCHASE_ORDER','ORDER_ITEM','OPNAME'
        ref_id: text("ref_id"),
        journal_id: uuid("journal_id").references(() => journals.id, { onDelete: "set null" }),
        memo: text("memo"),
        created_by: text("created_by").references(() => users.id, { onDelete: "set null" }),
        occurred_at: timestamp("occurred_at").defaultNow().notNull(),
    },
    (t) => ({
        item_time_idx: index("idx_inv_mov_item_time").on(t.item_id, t.occurred_at),
        kind_time_idx: index("idx_inv_mov_kind_time").on(t.kind, t.occurred_at),
        journal_idx: index("idx_inv_mov_journal").on(t.journal_id),
    })
);

