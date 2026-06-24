-- AFF: dedup affiliate_clicks by a (code, ip, 6h-bucket) fingerprint. The app writes
-- fingerprint = sha256(code|ip|bucket) and relies on INSERT ... ON CONFLICT DO NOTHING
-- against this UNIQUE index to record exactly one click per visitor per 6h window —
-- race-free (no read-then-write), and user_agent is deliberately NOT in the key so it
-- cannot be rotated to inflate the count. The index also serves the dedup lookup.
-- affiliate_clicks was previously never written, so no existing row can violate it.
CREATE UNIQUE INDEX IF NOT EXISTS "idx_affiliate_clicks_fingerprint" ON "affiliate_clicks" ("fingerprint");
