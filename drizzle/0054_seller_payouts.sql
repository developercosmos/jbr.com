-- Fulfillment redesign Fase 3: payout seller (Xendit Disbursement, admin-approved).
-- Alur: seller request (PENDING) -> admin approve -> Xendit disbursement (PROCESSING)
-- -> webhook COMPLETED/FAILED. GL (recordSellerPayout, drain akun 22000) hanya saat
-- COMPLETED. Idempotensi via external_id (unik) + xendit_disbursement_id.
DO $$ BEGIN
    CREATE TYPE "payout_status" AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "seller_payouts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "seller_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" numeric(12,2) NOT NULL,
    "bank_fee" numeric(12,2) NOT NULL DEFAULT '0',
    "status" "payout_status" NOT NULL DEFAULT 'PENDING',
    "bank_code" text NOT NULL,
    "bank_account_number" text NOT NULL,
    "bank_account_name" text NOT NULL,
    "external_id" text NOT NULL UNIQUE,
    "xendit_disbursement_id" text,
    "failure_reason" text,
    "requested_at" timestamptz NOT NULL DEFAULT now(),
    "approved_at" timestamptz,
    "approved_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "completed_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_seller_payouts_seller" ON "seller_payouts" ("seller_id");
CREATE INDEX IF NOT EXISTS "idx_seller_payouts_status" ON "seller_payouts" ("status");
CREATE INDEX IF NOT EXISTS "idx_seller_payouts_xendit" ON "seller_payouts" ("xendit_disbursement_id");

-- Seller payout bank account (account number + holder). users already has
-- payout_bank_name; add the rest so disbursements have a real destination.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_bank_account_number" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payout_bank_account_name" text;
