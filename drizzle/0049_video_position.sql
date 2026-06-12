-- Posisi slide video dalam galeri produk (0 = slide pertama), diatur seller.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "video_position" integer DEFAULT 0;
