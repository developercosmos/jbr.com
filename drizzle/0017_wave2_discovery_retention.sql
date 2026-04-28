-- Wave 2 (Phase 13-14): Discovery + Retention schema additions
-- Idempotent: every CREATE/ALTER guarded with IF NOT EXISTS where supported.

-- REC-02: recently viewed listings per user
CREATE TABLE IF NOT EXISTS "user_recently_viewed" (
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "viewed_at" timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY ("user_id", "product_id")
);
CREATE INDEX IF NOT EXISTS "idx_user_recently_viewed_at" ON "user_recently_viewed" ("user_id", "viewed_at" DESC);

-- REC-03: cart save-for-later state
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "saved_for_later" boolean NOT NULL DEFAULT false;

-- ALERT-02: cart abandonment tracking
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "abandonment_state" text;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "last_mutated_at" timestamp NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS "idx_carts_abandonment" ON "carts" ("abandonment_state", "last_mutated_at");

-- ALERT-01: wishlist price-drop baselines
CREATE TABLE IF NOT EXISTS "wishlist_price_baselines" (
    "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "baseline_price" numeric(12, 2) NOT NULL,
    "baseline_stock" integer NOT NULL DEFAULT 0,
    "last_alerted_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now(),
    PRIMARY KEY ("user_id", "product_id")
);

-- ALERT-01 + ALERT-02: notification_type enum extension
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'WISHLIST_PRICE_DROP';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'CART_ABANDONMENT_REMINDER';

-- CACHE-03: image variants persisted alongside original file
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "variants" jsonb;
