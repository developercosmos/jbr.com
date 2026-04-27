-- RATE-01: Seller-level reputation aggregate.
CREATE TABLE IF NOT EXISTS "seller_ratings" (
    "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "avg_rating" numeric(3, 2) NOT NULL DEFAULT 0,
    "rating_count" integer NOT NULL DEFAULT 0,
    "completion_rate" numeric(5, 2) NOT NULL DEFAULT 0,
    "response_time_minutes_avg" integer NOT NULL DEFAULT 0,
    "cancellation_rate" numeric(5, 2) NOT NULL DEFAULT 0,
    "last_recomputed_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_seller_ratings_avg" ON "seller_ratings" ("avg_rating");

-- RATE-02: Buyer rating with reveal-window pattern.
CREATE TABLE IF NOT EXISTS "buyer_ratings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
    "rater_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "ratee_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "direction" text NOT NULL,
    "rating" integer NOT NULL,
    "tags" text[],
    "comment" text,
    "submitted_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "buyer_ratings_direction_chk" CHECK ("direction" IN ('SELLER_RATES_BUYER', 'BUYER_RATES_SELLER')),
    CONSTRAINT "buyer_ratings_rating_chk" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "buyer_ratings_unique" UNIQUE ("order_id", "direction")
);

CREATE INDEX IF NOT EXISTS "idx_buyer_ratings_ratee" ON "buyer_ratings" ("ratee_id");
CREATE INDEX IF NOT EXISTS "idx_buyer_ratings_order" ON "buyer_ratings" ("order_id");

-- RATE-02 surface: cached aggregate on users.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "buyer_score" numeric(3, 2) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "buyer_score_count" integer NOT NULL DEFAULT 0;
