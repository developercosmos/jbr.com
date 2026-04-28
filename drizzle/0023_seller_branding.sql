-- ============================================================
-- 0023 — Seller branding (store tagline + banner)
-- Adds optional branding fields used by /seller/settings.
-- ============================================================

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_tagline" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_banner_url" text;
