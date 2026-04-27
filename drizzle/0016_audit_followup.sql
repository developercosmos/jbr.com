-- AUDIT-FOLLOWUP: Prevent double-redeem race on voucher.
-- Partial unique index handles the nullable order_id case.
CREATE UNIQUE INDEX IF NOT EXISTS "voucher_redemptions_order_voucher_uniq"
    ON "voucher_redemptions" ("voucher_id", "order_id")
    WHERE "order_id" IS NOT NULL;
