-- Wave 2 batch B (Phase 15-16): Analytics + Search infrastructure schema.

-- ANLY-01: per-product event ingestion
CREATE TABLE IF NOT EXISTS "product_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
    "session_id" text,
    "event_type" text NOT NULL,
    "source" text,
    "search_term" text,
    "referrer" text,
    "occurred_at" timestamp NOT NULL DEFAULT now(),
    "meta" jsonb
);
CREATE INDEX IF NOT EXISTS "idx_product_events_product_type_time" ON "product_events" ("product_id", "event_type", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_product_events_occurred_at" ON "product_events" ("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_product_events_search_term" ON "product_events" ("search_term") WHERE "search_term" IS NOT NULL;

-- ANLY-01: pre-aggregated daily rollups for fast dashboards
CREATE TABLE IF NOT EXISTS "product_event_daily" (
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "date" date NOT NULL,
    "event_type" text NOT NULL,
    "count" integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("product_id", "date", "event_type")
);
CREATE INDEX IF NOT EXISTS "idx_product_event_daily_date" ON "product_event_daily" ("date");

-- ANLY-03: per-seller search-term landing rollups
CREATE TABLE IF NOT EXISTS "seller_search_terms_daily" (
    "seller_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "date" date NOT NULL,
    "term" text NOT NULL,
    "click_count" integer NOT NULL DEFAULT 0,
    "impression_count" integer NOT NULL DEFAULT 0,
    PRIMARY KEY ("seller_id", "date", "term")
);
CREATE INDEX IF NOT EXISTS "idx_seller_search_terms_seller_date" ON "seller_search_terms_daily" ("seller_id", "date");

-- ANLY-04 weekly digest tracking
CREATE TABLE IF NOT EXISTS "seller_digest_log" (
    "seller_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "last_sent_at" timestamp,
    "last_period_start" date,
    "last_period_end" date
);

-- Notification type extensions for digest dispatch
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SELLER_WEEKLY_DIGEST';
