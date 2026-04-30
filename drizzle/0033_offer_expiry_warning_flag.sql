-- 0033_offer_expiry_warning_flag.sql
-- DIF-16: feature flag baru untuk highlight tawaran yang akan kedaluwarsa
-- < 6 jam lagi. Default OFF supaya admin bisa rollout via /admin/feature-flags.
-- Idempotent: ON CONFLICT DO NOTHING.

INSERT INTO "feature_flags" ("key", "description", "category", "owner")
VALUES (
    'dif.offer_expiry_warning',
    'Highlight tawaran yang akan kedaluwarsa < 6 jam (DIF-16)',
    'differentiator',
    'TBD'
)
ON CONFLICT ("key") DO NOTHING;
