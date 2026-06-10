-- Affiliate KTP: private file storage + async OCR screening (like seller KYC).
-- - ktp_file_id: FK to files (private, is_public=false, served via /api/files/[id]).
--   Replaces the old ktp_url flow where the KTP image was uploaded PUBLIC via
--   /api/upload and readable by anyone with the URL (PII exposure). ktp_url is
--   kept for legacy rows only.
-- - ocr_status / ocr: same shape as seller_kyc (PENDING|DONE|FAILED|SKIPPED).
ALTER TABLE "affiliate_accounts" ADD COLUMN IF NOT EXISTS "ktp_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
ALTER TABLE "affiliate_accounts" ADD COLUMN IF NOT EXISTS "ocr_status" text;
ALTER TABLE "affiliate_accounts" ADD COLUMN IF NOT EXISTS "ocr" jsonb;

CREATE INDEX IF NOT EXISTS "idx_affiliate_accounts_ocr_status" ON "affiliate_accounts" ("ocr_status");

-- Feature flag for the affiliate OCR screening (OFF by default; toggle in
-- Admin -> Feature Flags, or override with FEATURE_AFFILIATE_OCR=force-on).
INSERT INTO "feature_flags" ("key", "description", "enabled", "rollout_pct", "category")
VALUES ('affiliate.ocr', 'OCR pra-screening KTP via LLM lokal untuk pendaftaran affiliate (advisory, async).', false, 0, 'kyc')
ON CONFLICT ("key") DO NOTHING;
