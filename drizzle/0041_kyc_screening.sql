-- In-house preliminary KYC auto-screening.
-- - files.content_hash: sha256 of the bytes, to detect the SAME document reused
--   across different accounts (fraud signal).
-- - seller_kyc.nik: the seller-entered National ID number (encrypted, PDP).
-- - seller_kyc.nik_hash: sha256 of the normalized NIK, for cross-account dup checks
--   (encrypted nik can't be compared directly).
-- - seller_kyc.screening: the auto-screen result { riskLevel, score, autoReject, flags, ranAt }.
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "content_hash" text;
ALTER TABLE "seller_kyc" ADD COLUMN IF NOT EXISTS "nik" text;
ALTER TABLE "seller_kyc" ADD COLUMN IF NOT EXISTS "nik_hash" text;
ALTER TABLE "seller_kyc" ADD COLUMN IF NOT EXISTS "screening" jsonb;

CREATE INDEX IF NOT EXISTS "idx_files_content_hash" ON "files" ("content_hash");
CREATE INDEX IF NOT EXISTS "idx_seller_kyc_nik_hash" ON "seller_kyc" ("nik_hash");
