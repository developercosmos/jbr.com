-- Video produk (opsional, 1 per produk). Batas ukuran & durasi configurable via
-- accounting_settings: product.video_max_mb (default 25), product.video_max_seconds (default 60).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_url" text;
