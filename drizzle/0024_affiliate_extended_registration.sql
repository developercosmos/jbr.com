-- AFF-EXT: Extended affiliate registration fields
-- Adds KTP, identity, bank, instagram, phone, statement to affiliate_accounts

ALTER TABLE "affiliate_accounts"
    ADD COLUMN IF NOT EXISTS "full_name"        text,
    ADD COLUMN IF NOT EXISTS "nik"              text,
    ADD COLUMN IF NOT EXISTS "phone"            text,
    ADD COLUMN IF NOT EXISTS "instagram_handle" text,
    ADD COLUMN IF NOT EXISTS "ktp_url"          text,
    ADD COLUMN IF NOT EXISTS "statement_url"    text,
    ADD COLUMN IF NOT EXISTS "bank_name"        text,
    ADD COLUMN IF NOT EXISTS "bank_account_number" text,
    ADD COLUMN IF NOT EXISTS "bank_account_name"   text;
