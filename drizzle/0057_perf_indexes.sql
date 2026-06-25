-- PERF: hot-path composite indexes surfaced by the performance audit. All are
-- additive + idempotent. Names match src/db/schema.ts exactly.

-- orders: lists filter by seller/buyer, sort created_at DESC
CREATE INDEX IF NOT EXISTS "idx_orders_seller_created" ON "orders" ("seller_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_orders_buyer_created" ON "orders" ("buyer_id", "created_at");

-- messages: unread-count + per-conversation reads; timeline join on product_reference_id
CREATE INDEX IF NOT EXISTS "idx_messages_conv_read_sender" ON "messages" ("conversation_id", "is_read", "sender_id");
CREATE INDEX IF NOT EXISTS "idx_messages_product_ref" ON "messages" ("product_reference_id");

-- payments: reconcile sweep WHERE status='PENDING' ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS "idx_payments_status_created" ON "payments" ("status", "created_at");

-- reviews: per-buyer rate-limit window
CREATE INDEX IF NOT EXISTS "idx_reviews_buyer_created" ON "reviews" ("buyer_id", "created_at");

-- products: catalog WHERE status='PUBLISHED' ORDER BY created_at / price
CREATE INDEX IF NOT EXISTS "idx_products_status_created" ON "products" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_products_status_price" ON "products" ("status", "price");
