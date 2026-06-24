-- COD safety: when the courier's cash was actually collected. COD escrow is only
-- recognized + released once this is set (buyer confirmReceipt, or a future
-- courier/Biteship COD-settlement signal) — never on a bare "delivered" status.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cod_collected_at" timestamptz;
