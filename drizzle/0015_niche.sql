-- NICHE-01: Spec fields on products (badminton domain).
CREATE TYPE "racket_weight_class" AS ENUM ('2U', '3U', '4U', '5U', '6U');
CREATE TYPE "racket_balance" AS ENUM ('HEAD_HEAVY', 'EVEN', 'HEAD_LIGHT');
CREATE TYPE "racket_shaft_flex" AS ENUM ('STIFF', 'MEDIUM', 'FLEXIBLE');
CREATE TYPE "racket_grip_size" AS ENUM ('G2', 'G3', 'G4', 'G5', 'G6');

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_class" "racket_weight_class";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "balance" "racket_balance";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shaft_flex" "racket_shaft_flex";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "grip_size" "racket_grip_size";
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "max_string_tension_lbs" integer;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stiffness_rating" integer;

CREATE INDEX IF NOT EXISTS "idx_products_weight_class" ON "products" ("weight_class");
CREATE INDEX IF NOT EXISTS "idx_products_balance" ON "products" ("balance");
CREATE INDEX IF NOT EXISTS "idx_products_shaft_flex" ON "products" ("shaft_flex");

-- NICHE-04: String service add-on at order line.
CREATE TABLE IF NOT EXISTS "string_service_orders" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
    "string_brand" text NOT NULL,
    "string_gauge" text,
    "tension_lbs" integer NOT NULL,
    "service_fee" numeric(12, 2) NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'PENDING',
    "completed_at" timestamp,
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "string_service_status_chk" CHECK ("status" IN ('PENDING', 'IN_PROGRESS', 'DONE'))
);

CREATE INDEX IF NOT EXISTS "idx_string_service_order_item" ON "string_service_orders" ("order_item_id");

-- NICHE-05: Player profile for recommendation.
CREATE TYPE "player_level" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');
CREATE TYPE "play_style" AS ENUM ('OFFENSIVE', 'DEFENSIVE', 'ALL_AROUND', 'DOUBLES_FRONT', 'DOUBLES_BACK');

CREATE TABLE IF NOT EXISTS "player_profiles" (
    "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "level" "player_level",
    "play_style" "play_style",
    "dominant_hand" text,
    "preferred_weight_class" "racket_weight_class",
    "preferred_balance" "racket_balance",
    "preferred_shaft_flex" "racket_shaft_flex",
    "updated_at" timestamp NOT NULL DEFAULT now()
);
