-- MON-01: Platform fee rules with category + price-bracket scoping.
CREATE TYPE "fee_rule_mode" AS ENUM ('PERCENT', 'FIXED', 'TIERED');
CREATE TYPE "fee_value_mode" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE IF NOT EXISTS "platform_fee_rules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "scope_category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
    "scope_seller_tier" text,
    "valid_from" timestamp NOT NULL DEFAULT now(),
    "valid_to" timestamp,
    "priority" integer NOT NULL DEFAULT 100,
    "is_active" boolean NOT NULL DEFAULT true,
    "mode" "fee_rule_mode" NOT NULL DEFAULT 'PERCENT',
    "default_value" numeric(12, 4) NOT NULL DEFAULT 0,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "platform_fee_rules_tier_chk" CHECK ("scope_seller_tier" IS NULL OR "scope_seller_tier" IN ('T0','T1','T2'))
);

CREATE INDEX IF NOT EXISTS "idx_platform_fee_rules_priority" ON "platform_fee_rules" ("priority" DESC);
CREATE INDEX IF NOT EXISTS "idx_platform_fee_rules_active" ON "platform_fee_rules" ("is_active");

CREATE TABLE IF NOT EXISTS "platform_fee_rule_brackets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "rule_id" uuid NOT NULL REFERENCES "platform_fee_rules"("id") ON DELETE CASCADE,
    "min_price" numeric(12, 2) NOT NULL DEFAULT 0,
    "max_price" numeric(12, 2),
    "value" numeric(12, 4) NOT NULL,
    "value_mode" "fee_value_mode" NOT NULL DEFAULT 'PERCENT'
);

CREATE INDEX IF NOT EXISTS "idx_platform_fee_rule_brackets_rule" ON "platform_fee_rule_brackets" ("rule_id");

-- order_items snapshots the rule applied at order creation so fee changes don't retroact.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "fee_rule_id" uuid REFERENCES "platform_fee_rules"("id") ON DELETE SET NULL;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "resolved_fee_value" numeric(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "resolved_fee_currency" text NOT NULL DEFAULT 'IDR';

-- MON-03: Double-entry ledger for marketplace money movements.
CREATE TYPE "ledger_account_type" AS ENUM ('PLATFORM', 'USER_WALLET', 'ESCROW', 'EXTERNAL');

CREATE TABLE IF NOT EXISTS "ledger_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "type" "ledger_account_type" NOT NULL,
    "owner_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
    "name" text NOT NULL,
    "currency" text NOT NULL DEFAULT 'IDR',
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "ledger_accounts_user_uniq" UNIQUE ("type", "owner_user_id", "currency")
);

CREATE TABLE IF NOT EXISTS "ledger_entries" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "entry_group_id" uuid NOT NULL,
    "account_id" uuid NOT NULL REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT,
    "debit" numeric(14, 2) NOT NULL DEFAULT 0,
    "credit" numeric(14, 2) NOT NULL DEFAULT 0,
    "currency" text NOT NULL DEFAULT 'IDR',
    "ref_type" text NOT NULL,
    "ref_id" text NOT NULL,
    "memo" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "ledger_entries_amount_chk" CHECK (
        ("debit" >= 0) AND ("credit" >= 0) AND NOT ("debit" > 0 AND "credit" > 0)
    )
);

CREATE INDEX IF NOT EXISTS "idx_ledger_entries_group" ON "ledger_entries" ("entry_group_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_entries_account" ON "ledger_entries" ("account_id");
CREATE INDEX IF NOT EXISTS "idx_ledger_entries_ref" ON "ledger_entries" ("ref_type", "ref_id");

-- MON-04: Voucher engine.
CREATE TYPE "voucher_type" AS ENUM ('PERCENT', 'FIXED', 'FREE_SHIPPING');

CREATE TABLE IF NOT EXISTS "vouchers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" text NOT NULL UNIQUE,
    "type" "voucher_type" NOT NULL,
    "value" numeric(12, 2) NOT NULL DEFAULT 0,
    "max_uses" integer,
    "max_uses_per_user" integer NOT NULL DEFAULT 1,
    "valid_from" timestamp NOT NULL DEFAULT now(),
    "valid_to" timestamp,
    "min_order_amount" numeric(12, 2),
    "scope" jsonb,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vouchers_active" ON "vouchers" ("is_active");

CREATE TABLE IF NOT EXISTS "voucher_redemptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "voucher_id" uuid NOT NULL REFERENCES "vouchers"("id") ON DELETE CASCADE,
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
    "applied_amount" numeric(12, 2) NOT NULL,
    "redeemed_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_voucher_redemptions_voucher" ON "voucher_redemptions" ("voucher_id");
CREATE INDEX IF NOT EXISTS "idx_voucher_redemptions_user" ON "voucher_redemptions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_voucher_redemptions_order" ON "voucher_redemptions" ("order_id");
