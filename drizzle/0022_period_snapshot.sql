-- ============================================================
-- 0022 — Period snapshot (Phase 15)
-- Snapshots TB / P&L / BS at period close so closed-period reports
-- remain immutable even if backdated journals slip through.
-- ============================================================

CREATE TABLE IF NOT EXISTS "accounting_period_snapshot" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "period_id"     uuid NOT NULL REFERENCES "accounting_periods"("id") ON DELETE CASCADE,
    "report"        text NOT NULL,           -- 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'cash_flow'
    "payload"       jsonb NOT NULL,
    "totals"        jsonb,                   -- quick-access summary {totalDebit,totalCredit,netProfit,...}
    "captured_at"   timestamp NOT NULL DEFAULT now(),
    "captured_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
    UNIQUE ("period_id", "report")
);

CREATE INDEX IF NOT EXISTS "idx_acc_period_snap_period" ON "accounting_period_snapshot" ("period_id");
CREATE INDEX IF NOT EXISTS "idx_acc_period_snap_report" ON "accounting_period_snapshot" ("report");
