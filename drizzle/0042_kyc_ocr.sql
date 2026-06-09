-- Async OCR pre-screening of KYC documents via a local LLM (feature-flagged).
-- - seller_kyc.ocr_status: drives the background sweep (PENDING|DONE|FAILED|SKIPPED, null = n/a).
-- - seller_kyc.ocr: full OCR result (extracted fields + NIK cross-check verdict).
ALTER TABLE "seller_kyc" ADD COLUMN IF NOT EXISTS "ocr_status" text;
ALTER TABLE "seller_kyc" ADD COLUMN IF NOT EXISTS "ocr" jsonb;

CREATE INDEX IF NOT EXISTS "idx_seller_kyc_ocr_status" ON "seller_kyc" ("ocr_status");

-- Register the OCR feature flag (OFF by default). Toggle it in the admin Feature
-- Flags UI, or override per-environment with FEATURE_KYC_OCR=force-on / force-off.
INSERT INTO "feature_flags" ("key", "description", "enabled", "rollout_pct", "category")
VALUES ('kyc.ocr', 'OCR pra-screening KTP via LLM lokal untuk KYC seller (advisory, async).', false, 0, 'kyc')
ON CONFLICT ("key") DO NOTHING;
