-- BARG-02: per-listing bargaining controls.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "bargain_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "min_acceptable_price" numeric(12, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "max_offer_rounds" integer NOT NULL DEFAULT 3;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "auto_decline_below" numeric(12, 2);

-- BARG-01: offer state machine.
CREATE TYPE "offer_status" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');

CREATE TABLE IF NOT EXISTS "offers" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "listing_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "variant_id" uuid REFERENCES "product_variants"("id") ON DELETE SET NULL,
    "buyer_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "seller_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" numeric(12, 2) NOT NULL,
    "status" "offer_status" NOT NULL DEFAULT 'PENDING',
    "round" integer NOT NULL DEFAULT 1,
    "parent_offer_id" uuid REFERENCES "offers"("id") ON DELETE SET NULL,
    "actor_role" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "decided_at" timestamp,
    "decided_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "checkout_token" text UNIQUE,
    "checkout_token_expires_at" timestamp,
    "checkout_token_used_at" timestamp,
    "notes" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "offers_actor_chk" CHECK ("actor_role" IN ('buyer', 'seller')),
    CONSTRAINT "offers_amount_chk" CHECK ("amount" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_offers_listing" ON "offers" ("listing_id");
CREATE INDEX IF NOT EXISTS "idx_offers_buyer_status" ON "offers" ("buyer_id", "status");
CREATE INDEX IF NOT EXISTS "idx_offers_seller_status" ON "offers" ("seller_id", "status");
CREATE INDEX IF NOT EXISTS "idx_offers_status_expires" ON "offers" ("status", "expires_at");
