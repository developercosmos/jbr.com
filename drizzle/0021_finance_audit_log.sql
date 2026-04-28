-- ============================================================
-- 0021 — Finance audit log (Phase 10)
-- Append-only log for every privileged finance write action:
-- settings change, period lock/close/reopen, manual journal, inventory adj.
-- ============================================================

CREATE TABLE IF NOT EXISTS "accounting_audit_log" (
    "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "action"        text NOT NULL,            -- e.g. SETTING_UPDATE, PERIOD_LOCK, JOURNAL_MANUAL_POST
    "actor_id"      text REFERENCES "users"("id") ON DELETE SET NULL,
    "actor_email"   text,
    "target_type"   text,                     -- e.g. 'setting', 'period', 'journal', 'inventory_item'
    "target_id"     text,
    "payload"       jsonb,                    -- snapshot of input or result
    "ip"            text,
    "user_agent"    text,
    "occurred_at"   timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_acc_audit_action_time" ON "accounting_audit_log" ("action","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_acc_audit_actor_time"  ON "accounting_audit_log" ("actor_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_acc_audit_target"      ON "accounting_audit_log" ("target_type","target_id");
