-- TRUST-02: Add ORDER_COMPLETED to notification_type so escrow auto-release can notify both audiences.
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'ORDER_COMPLETED';

-- TRUST-02: Track when an order becomes eligible for automatic completion after delivery.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "release_due_at" timestamp;

-- TRUST-02: Allow buyer/seller to see when an order auto-completes; index helps the cron sweep.
CREATE INDEX IF NOT EXISTS "idx_orders_release_due_at" ON "orders" ("release_due_at");

-- TRUST-03: Dispute SLA tracking and escalation counter.
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "response_due_at" timestamp;
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "resolution_due_at" timestamp;
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "escalation_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "idx_disputes_response_due_at" ON "disputes" ("response_due_at");
CREATE INDEX IF NOT EXISTS "idx_disputes_resolution_due_at" ON "disputes" ("resolution_due_at");
