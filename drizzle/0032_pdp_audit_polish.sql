-- 0032_pdp_audit_polish.sql
-- Cleanup batch from 2026-04-30 audit:
--   * DIF-13: intent_score + scroll_depth_pct on offers
--   * PDP-06: PDP_TIME_ON_PAGE_BUCKET event type already wired in code; ensure index ready
--   * FLAG-04 audience: column already jsonb, no schema change needed
--   * FLAG-09 cron / FLAG-12 cleanup: only application-level, no schema

-- DIF-13: Per-offer intent signal derived from PDP time-on-page + scroll depth.
ALTER TABLE "offers"
    ADD COLUMN IF NOT EXISTS "intent_score" smallint,
    ADD COLUMN IF NOT EXISTS "scroll_depth_pct" smallint;

CREATE INDEX IF NOT EXISTS "idx_offers_intent_score"
    ON "offers" ("intent_score" DESC NULLS LAST);

-- DIF-08: Optional persistent fallback for live presence aggregates if Redis is
-- unavailable. Holds last-seen-at per (product_id, session_id). TTL enforced
-- in cleanup cron (ROW deletion when last_seen_at < now() - 90s).
CREATE TABLE IF NOT EXISTS "pdp_presence_pings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
    "session_id" text NOT NULL,
    "intent" text NOT NULL DEFAULT 'view'
        CHECK ("intent" IN ('view', 'bidding')),
    "last_seen_at" timestamp NOT NULL DEFAULT NOW(),
    UNIQUE ("product_id", "session_id")
);

CREATE INDEX IF NOT EXISTS "idx_presence_product_seen"
    ON "pdp_presence_pings" ("product_id", "last_seen_at" DESC);

-- FLAG security: log every "high-risk" toggle (trust + kill-switch) with the
-- typed confirmation phrase the admin wrote so we can prove intent later.
ALTER TABLE "feature_flag_audit_log"
    ADD COLUMN IF NOT EXISTS "confirmation_phrase" text;
