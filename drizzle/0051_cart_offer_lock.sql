-- Accepted-offer items live in the buyer's cart, linked to the offer that locks
-- the negotiated price + the 24h checkout window. Nullable: normal cart lines
-- keep offer_id NULL. ON DELETE SET NULL so removing an offer just demotes the
-- line back to a normal cart entry.
ALTER TABLE carts ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES offers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_carts_offer ON carts(offer_id) WHERE offer_id IS NOT NULL;
