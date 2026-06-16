-- Product "sport" grouping for Browse by Sport + search filter.
DO $$ BEGIN
    CREATE TYPE "product_sport" AS ENUM (
        'PADEL', 'PICKLEBALL', 'TENNIS', 'BADMINTON', 'SQUASH', 'SEPAK_BOLA', 'OTHERS', 'FASHION'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sport" "product_sport";

CREATE INDEX IF NOT EXISTS "idx_products_sport" ON "products" ("sport");
