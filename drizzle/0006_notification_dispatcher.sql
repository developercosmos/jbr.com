ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'REVIEW_RECEIVED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'DISPUTE_OPENED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'DISPUTE_UPDATED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'OFFER_RECEIVED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'OFFER_ACCEPTED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'AFFILIATE_CONVERSION';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'PAYOUT_PROCESSED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SELLER_ACTIVATED';--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'SELLER_REVIEW_NEEDED';--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notifications_idempotency_key" ON "notifications" USING btree ("idempotency_key");