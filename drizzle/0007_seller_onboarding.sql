ALTER TYPE "store_status" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payout_bank_name" text;