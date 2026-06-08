-- Per-seller layout option: overlay the store header (avatar, name, rating,
-- followers, actions) ON TOP of the banner (Shopee-style) instead of stacking it
-- in a separate panel below. Default off → existing stacked layout unchanged.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "store_header_overlay" boolean DEFAULT false NOT NULL;
