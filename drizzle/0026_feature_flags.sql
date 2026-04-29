CREATE TABLE IF NOT EXISTS "feature_flags" (
    "key" text PRIMARY KEY,
    "description" text NOT NULL,
    "enabled" boolean NOT NULL DEFAULT false,
    "rollout_pct" smallint NOT NULL DEFAULT 0,
    "audience" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "variants" jsonb,
    "parent_key" text,
    "scheduled_enable_at" timestamp,
    "scheduled_disable_at" timestamp,
    "category" text NOT NULL DEFAULT 'general',
    "owner" text,
    "updated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "last_toggled_at" timestamp,
    "notes" text,
    "created_at" timestamp NOT NULL DEFAULT now(),
    "updated_at" timestamp NOT NULL DEFAULT now(),
    CONSTRAINT "feature_flags_rollout_pct_chk" CHECK ("rollout_pct" BETWEEN 0 AND 100)
);

CREATE INDEX IF NOT EXISTS "idx_feature_flags_category" ON "feature_flags" ("category");
CREATE INDEX IF NOT EXISTS "idx_feature_flags_enabled" ON "feature_flags" ("enabled");
CREATE INDEX IF NOT EXISTS "idx_feature_flags_parent" ON "feature_flags" ("parent_key");

CREATE TABLE IF NOT EXISTS "feature_flag_audit_log" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "flag_key" text NOT NULL,
    "changed_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "before_state" jsonb NOT NULL,
    "after_state" jsonb NOT NULL,
    "reason" text,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flag_audit_key_time" ON "feature_flag_audit_log" ("flag_key", "created_at");
CREATE INDEX IF NOT EXISTS "idx_flag_audit_changed_by" ON "feature_flag_audit_log" ("changed_by");

CREATE TABLE IF NOT EXISTS "feature_flag_kill_switch" (
    "id" smallint PRIMARY KEY DEFAULT 1,
    "active" boolean NOT NULL DEFAULT false,
    "scope" text NOT NULL DEFAULT 'all-new',
    "activated_by" text REFERENCES "users"("id") ON DELETE SET NULL,
    "activated_at" timestamp,
    "reason" text,
    CONSTRAINT "feature_flag_kill_switch_id_chk" CHECK ("id" = 1),
    CONSTRAINT "feature_flag_kill_switch_scope_chk" CHECK ("scope" IN ('all-new', 'pdp-only', 'differentiator-only'))
);

INSERT INTO "feature_flag_kill_switch" ("id", "active", "scope")
VALUES (1, false, 'all-new')
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "feature_flags" ("key", "description", "category", "owner") VALUES
('pdp.inline_offer', 'Inline offer input di sidebar PDP (PDP-02)', 'pdp', 'TBD'),
('pdp.offer_rate_limit', 'Per-(buyer,product) offer rate limit (PDP-02b)', 'pdp', 'TBD'),
('pdp.seller_badges', 'Seller trust badges di PDP (PDP-03)', 'pdp', 'TBD'),
('pdp.seller_join_date', 'Seller join date display (PDP-04)', 'pdp', 'TBD'),
('pdp.review_thumbnail', 'Review product thumbnail via CACHE-03 (PDP-05)', 'pdp', 'TBD'),
('pdp.buyer_rating', 'Seller rates buyer flow (PDP-08)', 'trust', 'TBD'),
('pdp.buyer_reputation', 'Buyer reputation aggregation (PDP-09)', 'trust', 'TBD'),
('pdp.dispute_rating', 'Dispute buyer rating workflow (PDP-10)', 'trust', 'TBD'),
('dif.smart_offer_guardrail', 'Smart offer guardrail + win probability (DIF-01)', 'differentiator', 'TBD'),
('dif.seller_reliability_score', 'Seller reliability composite score (DIF-02)', 'differentiator', 'TBD'),
('dif.offer_sla', 'Offer SLA + auto follow-up (DIF-03)', 'differentiator', 'TBD'),
('dif.condition_checklist', 'Verified condition checklist pre-loved (DIF-04)', 'differentiator', 'TBD'),
('dif.compare_mode', 'PDP compare mode (DIF-05)', 'differentiator', 'TBD'),
('dif.negotiation_insights', 'Negotiation insights dashboard (DIF-06)', 'differentiator', 'TBD'),
('dif.two_way_reputation_surface', 'Two-way reputation UI surface (DIF-07)', 'differentiator', 'TBD'),
('dif.live_presence', 'Live buyer presence indicator (DIF-08)', 'differentiator', 'TBD'),
('dif.auto_counter', 'Auto-counter offer with floor price (DIF-09)', 'differentiator', 'TBD'),
('dif.trust_insurance', 'Trust insurance Bayar Aman+ (DIF-10)', 'differentiator', 'TBD'),
('dif.audit_replay', 'Negotiation audit replay (DIF-11)', 'differentiator', 'TBD'),
('dif.smart_questions', 'Smart question suggester chat (DIF-12)', 'differentiator', 'TBD'),
('dif.intent_score', 'PDP time-on-page intent score (DIF-13)', 'differentiator', 'TBD'),
('dif.tier_floor_price', 'Personalized tier floor price (DIF-14)', 'differentiator', 'TBD'),
('dif.match_score', 'Match score recommendation (DIF-15)', 'differentiator', 'TBD')
ON CONFLICT ("key") DO NOTHING;

UPDATE "feature_flags" SET "parent_key" = 'pdp.offer_rate_limit' WHERE "key" = 'pdp.inline_offer';
UPDATE "feature_flags" SET "parent_key" = 'pdp.buyer_reputation' WHERE "key" = 'dif.tier_floor_price';
UPDATE "feature_flags" SET "parent_key" = 'pdp.buyer_rating' WHERE "key" IN ('dif.two_way_reputation_surface', 'pdp.dispute_rating');