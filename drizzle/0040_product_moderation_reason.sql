-- Store WHY a product is under moderation so the seller sees a specific reason
-- (instead of a generic "sedang ditinjau" message) on the edit page.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "moderation_reason" text;
