-- Bug #10: track whether a product was ever approved to go live, so un-archiving a
-- previously-approved listing skips needless re-moderation (the auto content-gate
-- otherwise re-fires on every publish, bouncing an approved product to MODERATED).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;

-- Backfill: products that are (or were) live are treated as already-approved, so a
-- later "Aktifkan kembali" doesn't force re-review. DRAFT/MODERATED stay unapproved.
UPDATE "products"
SET "approved_at" = COALESCE("updated_at", "created_at")
WHERE "status" IN ('PUBLISHED', 'ARCHIVED') AND "approved_at" IS NULL;
