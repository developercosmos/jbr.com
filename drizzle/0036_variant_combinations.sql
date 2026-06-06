-- Combination variants: let one product_variants row represent a combination of
-- up to two option axes (e.g. Warna=Merah, Ukuran=M) with its own price/stock.
-- Columns are nullable so existing single-axis variants keep working unchanged.
-- Idempotent (IF NOT EXISTS) and applied once via the deploy run-once ledger.

ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option1_name"  text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option1_value" text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option2_name"  text;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "option2_value" text;
