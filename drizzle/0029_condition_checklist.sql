ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "condition_checklist" jsonb DEFAULT '[]'::jsonb;

UPDATE "products"
SET "condition_checklist" = '[]'::jsonb
WHERE "condition_checklist" IS NULL;
