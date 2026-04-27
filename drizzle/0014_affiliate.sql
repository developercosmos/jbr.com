-- AFF-01: Affiliate accounts.
CREATE TYPE "affiliate_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "attribution_status" AS ENUM ('PENDING', 'CLEARED', 'REVERSED');

CREATE TABLE IF NOT EXISTS "affiliate_accounts" (
    "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "code" text NOT NULL UNIQUE,
    "status" "affiliate_status" NOT NULL DEFAULT 'ACTIVE',
    "commission_rate_override" numeric(5, 2),
    "payout_method" text,
    "payout_account" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_affiliate_accounts_status" ON "affiliate_accounts" ("status");

-- AFF-02: Click & attribution.
CREATE TABLE IF NOT EXISTS "affiliate_clicks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "code" text NOT NULL,
    "fingerprint" text,
    "referrer" text,
    "landing_url" text,
    "ip" text,
    "user_agent" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "expires_at" timestamp NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_affiliate_clicks_code" ON "affiliate_clicks" ("code");

CREATE TABLE IF NOT EXISTS "affiliate_attributions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE CASCADE,
    "affiliate_user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "code" text NOT NULL,
    "computed_commission" numeric(12, 2) NOT NULL DEFAULT 0,
    "rate_used" numeric(5, 2) NOT NULL DEFAULT 0,
    "status" "attribution_status" NOT NULL DEFAULT 'PENDING',
    "created_at" timestamp NOT NULL DEFAULT now(),
    "decided_at" timestamp,
    "memo" text
);

CREATE INDEX IF NOT EXISTS "idx_affiliate_attributions_affiliate" ON "affiliate_attributions" ("affiliate_user_id");
CREATE INDEX IF NOT EXISTS "idx_affiliate_attributions_status" ON "affiliate_attributions" ("status");
