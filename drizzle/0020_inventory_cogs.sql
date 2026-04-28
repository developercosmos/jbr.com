-- ============================================================
-- 0020 — 1P Inventory + COGS sub-ledger (Phase 8)
-- Adds master inventory_items, append-only inventory_movements,
-- and seeds COA accounts 13100, 21100, 51100 for first-party module.
-- All idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================

DO $$ BEGIN
    CREATE TYPE "inventory_movement_kind" AS ENUM (
        'RECEIPT','ADJUSTMENT','ISSUE','RETURN_IN','RETURN_OUT'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "inventory_cost_method" AS ENUM ('MOVING_AVG','FIFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "sku"            text NOT NULL,
    "name"           text NOT NULL,
    "product_id"     uuid,
    "cost_method"    "inventory_cost_method" NOT NULL DEFAULT 'MOVING_AVG',
    "unit"           text NOT NULL DEFAULT 'PCS',
    "on_hand_qty"    numeric(18,4) NOT NULL DEFAULT 0,
    "avg_unit_cost"  numeric(18,4) NOT NULL DEFAULT 0,
    "on_hand_value"  numeric(18,2) NOT NULL DEFAULT 0,
    "is_active"      boolean NOT NULL DEFAULT true,
    "notes"          text,
    "created_at"     timestamp NOT NULL DEFAULT now(),
    "updated_at"     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_inv_items_sku"     ON "inventory_items" ("sku");
CREATE INDEX IF NOT EXISTS "idx_inv_items_product" ON "inventory_items" ("product_id");

CREATE TABLE IF NOT EXISTS "inventory_movements" (
    "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "item_id"      uuid NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "kind"         "inventory_movement_kind" NOT NULL,
    "qty"          numeric(18,4) NOT NULL,
    "unit_cost"    numeric(18,4) NOT NULL,
    "total_cost"   numeric(18,2) NOT NULL,
    "ref_type"     text,
    "ref_id"       text,
    "journal_id"   uuid REFERENCES "journals"("id") ON DELETE SET NULL,
    "memo"         text,
    "created_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
    "occurred_at"  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_inv_mov_item_time" ON "inventory_movements" ("item_id","occurred_at");
CREATE INDEX IF NOT EXISTS "idx_inv_mov_kind_time" ON "inventory_movements" ("kind","occurred_at");
CREATE INDEX IF NOT EXISTS "idx_inv_mov_journal"   ON "inventory_movements" ("journal_id");

-- ------------------------------------------------------------
-- COA seeds for 1P module (idempotent)
-- ------------------------------------------------------------
INSERT INTO "coa_accounts" ("code","name","class","normal_balance","is_postable","tax_kind","description") VALUES
    ('13100','Persediaan Barang 1P','ASSET','DEBIT', true, NULL, 'Stok 1P (dikelola platform); valuasi MOVING_AVG/FIFO'),
    ('21100','Utang Dagang Vendor 1P','LIABILITY','CREDIT', true, NULL, 'Hutang ke pemasok 1P (PO/GR matched)'),
    ('51100','HPP Barang 1P','COGS','DEBIT', true, NULL, 'Beban pokok penjualan barang 1P (proporsional dengan revenue 1P)')
ON CONFLICT ("code") DO NOTHING;
