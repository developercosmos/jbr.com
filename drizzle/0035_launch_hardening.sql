-- Launch-hardening schema changes (hand-authored, idempotent).
--
-- Context: this project deploys with `drizzle-kit push` (schema force-synced from
-- src/db/schema.ts), which never maintained per-migration snapshots. `drizzle-kit
-- generate` therefore produces incorrect diffs against the stale snapshot, so this
-- file is hand-authored. Every statement is guarded (IF NOT EXISTS / null-backfill /
-- catalog check) and is SAFE TO RE-RUN and safe to apply on a push-built DB. It also
-- serves as the baseline for switching to versioned `drizzle-kit migrate` later.

-- 1. ORDER_REFUNDED notification type (refund flow).
ALTER TYPE "public"."notification_type" ADD VALUE IF NOT EXISTS 'ORDER_REFUNDED';--> statement-breakpoint

-- 2. Affiliate payout idempotency columns.
ALTER TABLE "affiliate_attributions" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;--> statement-breakpoint
ALTER TABLE "affiliate_attributions" ADD COLUMN IF NOT EXISTS "payout_batch_id" text;--> statement-breakpoint

-- 3. Order voucher discount column.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- 4. Harden orders.shipping_cost: backfill nulls then enforce NOT NULL (avoids NaN
--    in parseFloat money math). Idempotent: SET NOT NULL is a no-op if already set.
UPDATE "orders" SET "shipping_cost" = '0' WHERE "shipping_cost" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_cost" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "shipping_cost" SET NOT NULL;--> statement-breakpoint

-- 5. One voucher redemption per (voucher, user, order) — makes redeemVoucher
--    idempotent and blocks duplicate-claim races on the same order.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_voucher_user_order" ON "voucher_redemptions" ("voucher_id","user_id","order_id");--> statement-breakpoint

-- 6. Hot-path indexes on order_items (order detail + analytics joins).
CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "order_items" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_order_items_product_id" ON "order_items" ("product_id");--> statement-breakpoint

-- 7. Referential integrity for previously-unconstrained FK columns. Added NOT VALID
--    so the constraint applies to NEW rows immediately without failing on legacy
--    data; run `VALIDATE CONSTRAINT` later in a maintenance window to check history.
--    Guarded via pg_constraint (Postgres has no ADD CONSTRAINT IF NOT EXISTS).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_string_service_orders_order_item') THEN
        ALTER TABLE "string_service_orders"
            ADD CONSTRAINT "fk_string_service_orders_order_item"
            FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE NOT VALID;
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_categories_parent') THEN
        ALTER TABLE "categories"
            ADD CONSTRAINT "fk_categories_parent"
            FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL NOT VALID;
    END IF;
END $$;--> statement-breakpoint

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_platform_fee_rules_scope_category') THEN
        ALTER TABLE "platform_fee_rules"
            ADD CONSTRAINT "fk_platform_fee_rules_scope_category"
            FOREIGN KEY ("scope_category_id") REFERENCES "categories"("id") ON DELETE SET NULL NOT VALID;
    END IF;
END $$;
