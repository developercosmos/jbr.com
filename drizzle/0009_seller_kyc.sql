DO $$ BEGIN
    CREATE TYPE seller_tier AS ENUM ('T0', 'T1', 'T2');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE kyc_status AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS tier seller_tier DEFAULT 'T0' NOT NULL;

CREATE TABLE IF NOT EXISTS seller_kyc (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier seller_tier NOT NULL DEFAULT 'T0',
    status kyc_status NOT NULL DEFAULT 'NOT_SUBMITTED',
    ktp_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    selfie_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    business_doc_file_id uuid REFERENCES files(id) ON DELETE SET NULL,
    submitted_at timestamp,
    reviewed_at timestamp,
    reviewer_id text REFERENCES users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamp DEFAULT now() NOT NULL,
    updated_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_kyc_user_id ON seller_kyc(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_kyc_tier ON seller_kyc(tier);
CREATE INDEX IF NOT EXISTS idx_seller_kyc_status ON seller_kyc(status);
