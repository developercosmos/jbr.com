-- Order-time product snapshot: captures the product/variant (image, specs,
-- variant, price) as it was when the order was placed, so a buyer's order
-- history stays accurate even if the seller later edits or deletes the product.
-- Nullable (old orders have none → display falls back to the live product).
-- Idempotent; applied once via the deploy run-once ledger.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_snapshot" jsonb;
