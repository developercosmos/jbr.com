ALTER TABLE "seller_ratings" ADD COLUMN IF NOT EXISTS "dispute_rate" numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE "seller_ratings" ADD COLUMN IF NOT EXISTS "reliability_score" numeric(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE "seller_ratings" ADD COLUMN IF NOT EXISTS "reliability_tier" text NOT NULL DEFAULT 'BRONZE';
