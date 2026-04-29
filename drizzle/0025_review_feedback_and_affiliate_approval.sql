ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "store_review_notes" text,
    ADD COLUMN IF NOT EXISTS "store_reviewed_at" timestamp,
    ADD COLUMN IF NOT EXISTS "store_reviewer_id" text REFERENCES "users"("id") ON DELETE SET NULL;

ALTER TYPE "affiliate_status" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "affiliate_accounts"
    ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "affiliate_accounts"
    ADD COLUMN IF NOT EXISTS "review_notes" text,
    ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp,
    ADD COLUMN IF NOT EXISTS "reviewer_id" text REFERENCES "users"("id") ON DELETE SET NULL;
