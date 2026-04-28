-- ============================================================
-- 0019_accounting_general_ledger.sql
-- Phase 1: Schema migrasi PSAK-compliant General Ledger
-- Refs: docs/accounting-gl-implementation-plan-2026-04-28.md (§5)
-- ============================================================

-- ----- 1. ENUMS -----
DO $$ BEGIN
  CREATE TYPE "account_class" AS ENUM (
    'ASSET','LIABILITY','EQUITY','REVENUE','CONTRA_REVENUE',
    'COGS','OPEX','OTHER_INCOME','OTHER_EXPENSE','TAX_EXPENSE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "account_normal_balance" AS ENUM ('DEBIT','CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ledger_book" AS ENUM ('PLATFORM','SELLER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "journal_status" AS ENUM ('DRAFT','POSTED','REVERSED','VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "journal_source" AS ENUM (
    'AUTO_ORDER','AUTO_PAYMENT','AUTO_REFUND','AUTO_PAYOUT','AUTO_FEE',
    'AUTO_TAX','AUTO_AFFILIATE','AUTO_ADJUST_PERIOD','MANUAL','IMPORT'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "tax_kind" AS ENUM (
    'PPN_OUT','PPN_IN','PPH_21','PPH_23','PPH_4_2','PPH_FINAL_UMKM',
    'PPH_25','PPH_29','PPN_PMSE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "period_status" AS ENUM ('OPEN','LOCKED','CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sales_register_event" AS ENUM ('SALE','REFUND','ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "sale_kind" AS ENUM ('AGENT_3P','PRINCIPAL_1P');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- 2. coa_accounts (Chart of Accounts) -----
CREATE TABLE IF NOT EXISTS "coa_accounts" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "code"           text NOT NULL,
  "name"           text NOT NULL,
  "class"          account_class NOT NULL,
  "normal_balance" account_normal_balance NOT NULL,
  "parent_id"      uuid REFERENCES "coa_accounts"("id") ON DELETE SET NULL,
  "is_postable"    boolean NOT NULL DEFAULT true,
  "currency"       text NOT NULL DEFAULT 'IDR',
  "book"           ledger_book NOT NULL DEFAULT 'PLATFORM',
  "tax_kind"       tax_kind,
  "is_active"      boolean NOT NULL DEFAULT true,
  "description"    text,
  "created_at"     timestamp NOT NULL DEFAULT now(),
  "updated_at"     timestamp NOT NULL DEFAULT now(),
  UNIQUE ("book","code")
);
CREATE INDEX IF NOT EXISTS "idx_coa_class"       ON "coa_accounts" ("class");
CREATE INDEX IF NOT EXISTS "idx_coa_parent"      ON "coa_accounts" ("parent_id");
CREATE INDEX IF NOT EXISTS "idx_coa_active"      ON "coa_accounts" ("is_active") WHERE "is_active" = true;

-- ----- 3. accounting_periods -----
CREATE TABLE IF NOT EXISTS "accounting_periods" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "book"        ledger_book NOT NULL DEFAULT 'PLATFORM',
  "year"        integer NOT NULL,
  "month"       integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  "starts_at"   date NOT NULL,
  "ends_at"     date NOT NULL,
  "status"      period_status NOT NULL DEFAULT 'OPEN',
  "locked_at"   timestamp,
  "locked_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
  "closed_at"   timestamp,
  "closed_by"   text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"  timestamp NOT NULL DEFAULT now(),
  UNIQUE ("book","year","month")
);
CREATE INDEX IF NOT EXISTS "idx_periods_book_status" ON "accounting_periods" ("book","status");

-- ----- 4. journals -----
CREATE TABLE IF NOT EXISTS "journals" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "book"                ledger_book NOT NULL DEFAULT 'PLATFORM',
  "book_owner_id"       text REFERENCES "users"("id") ON DELETE RESTRICT,
  "period_id"           uuid NOT NULL REFERENCES "accounting_periods"("id") ON DELETE RESTRICT,
  "journal_no"          text NOT NULL,
  "posted_at"           timestamp NOT NULL DEFAULT now(),
  "source"              journal_source NOT NULL,
  "description"         text NOT NULL,
  "ref_type"            text,
  "ref_id"              text,
  "status"              journal_status NOT NULL DEFAULT 'POSTED',
  "reverses_journal_id" uuid REFERENCES "journals"("id") ON DELETE SET NULL,
  "idempotency_key"     text UNIQUE,
  "hash_prev"           text,
  "hash_self"           text,
  "created_by"          text REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at"          timestamp NOT NULL DEFAULT now(),
  UNIQUE ("book","journal_no"),
  CHECK ("book" = 'PLATFORM' OR "book_owner_id" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "idx_journals_period"   ON "journals" ("book","period_id");
CREATE INDEX IF NOT EXISTS "idx_journals_ref"      ON "journals" ("ref_type","ref_id");
CREATE INDEX IF NOT EXISTS "idx_journals_posted"   ON "journals" ("posted_at");
CREATE INDEX IF NOT EXISTS "idx_journals_owner"    ON "journals" ("book","book_owner_id") WHERE "book_owner_id" IS NOT NULL;

-- ----- 5. journal_lines -----
CREATE TABLE IF NOT EXISTS "journal_lines" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journal_id"        uuid NOT NULL REFERENCES "journals"("id") ON DELETE CASCADE,
  "line_no"           integer NOT NULL,
  "account_id"        uuid NOT NULL REFERENCES "coa_accounts"("id") ON DELETE RESTRICT,
  "debit"             numeric(18,2) NOT NULL DEFAULT 0,
  "credit"            numeric(18,2) NOT NULL DEFAULT 0,
  "currency"          text NOT NULL DEFAULT 'IDR',
  "memo"              text,
  "partner_user_id"   text REFERENCES "users"("id") ON DELETE SET NULL,
  "partner_role"      text,  -- 'SELLER' | 'AFFILIATE' | 'BUYER'
  "tax_kind"          tax_kind,
  "tax_base"          numeric(18,2),
  "tax_rate"          numeric(6,4),
  "created_at"        timestamp NOT NULL DEFAULT now(),
  CHECK (
    ("debit" = 0 AND "credit" > 0) OR
    ("credit" = 0 AND "debit" > 0)
  ),
  UNIQUE ("journal_id","line_no")
);
CREATE INDEX IF NOT EXISTS "idx_jl_account"       ON "journal_lines" ("account_id");
CREATE INDEX IF NOT EXISTS "idx_jl_partner"       ON "journal_lines" ("partner_user_id","partner_role") WHERE "partner_user_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_jl_journal"       ON "journal_lines" ("journal_id","line_no");
CREATE INDEX IF NOT EXISTS "idx_jl_tax"           ON "journal_lines" ("tax_kind") WHERE "tax_kind" IS NOT NULL;

-- ----- 6. tax_profiles -----
CREATE TABLE IF NOT EXISTS "tax_profiles" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "kind"        tax_kind NOT NULL,
  "rate"        numeric(6,4) NOT NULL,
  "account_id"  uuid REFERENCES "coa_accounts"("id") ON DELETE RESTRICT,
  "valid_from"  date NOT NULL DEFAULT CURRENT_DATE,
  "valid_to"    date,
  "is_active"   boolean NOT NULL DEFAULT true,
  "notes"       text,
  "created_at"  timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_tax_profiles_kind_active" ON "tax_profiles" ("kind","is_active");

-- ----- 7. tax_documents -----
CREATE TABLE IF NOT EXISTS "tax_documents" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind"          tax_kind NOT NULL,
  "number"        text,
  "date"          date NOT NULL,
  "partner_user_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "partner_npwp"  text,
  "partner_name"  text,
  "dpp"           numeric(18,2) NOT NULL DEFAULT 0,
  "tax_amount"    numeric(18,2) NOT NULL DEFAULT 0,
  "journal_id"    uuid REFERENCES "journals"("id") ON DELETE SET NULL,
  "pdf_url"       text,
  "status"        text NOT NULL DEFAULT 'DRAFT', -- DRAFT|ISSUED|CANCELED
  "metadata"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_tax_docs_kind_date" ON "tax_documents" ("kind","date");
CREATE INDEX IF NOT EXISTS "idx_tax_docs_partner"   ON "tax_documents" ("partner_user_id") WHERE "partner_user_id" IS NOT NULL;

-- ----- 8. bank_accounts -----
CREATE TABLE IF NOT EXISTS "bank_accounts" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "coa_account_id" uuid NOT NULL REFERENCES "coa_accounts"("id") ON DELETE RESTRICT,
  "bank_name"      text NOT NULL,
  "account_no"     text NOT NULL,
  "account_holder" text NOT NULL,
  "is_escrow"      boolean NOT NULL DEFAULT false,
  "is_active"      boolean NOT NULL DEFAULT true,
  "currency"       text NOT NULL DEFAULT 'IDR',
  "created_at"     timestamp NOT NULL DEFAULT now()
);

-- ----- 9. bank_statement_lines -----
CREATE TABLE IF NOT EXISTS "bank_statement_lines" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bank_account_id"          uuid NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE,
  "statement_date"           date NOT NULL,
  "description"              text,
  "debit"                    numeric(18,2) NOT NULL DEFAULT 0,
  "credit"                   numeric(18,2) NOT NULL DEFAULT 0,
  "balance"                  numeric(18,2),
  "matched_journal_line_id"  uuid REFERENCES "journal_lines"("id") ON DELETE SET NULL,
  "imported_batch_id"        uuid,
  "created_at"               timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_bsl_bank_date" ON "bank_statement_lines" ("bank_account_id","statement_date");

-- ----- 10. sales_register (sub-ledger SKU-level) -----
CREATE TABLE IF NOT EXISTS "sales_register" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "journal_id"           uuid REFERENCES "journals"("id") ON DELETE SET NULL,
  "order_id"             uuid NOT NULL,
  "order_item_id"        uuid NOT NULL,
  "event"                sales_register_event NOT NULL,
  "event_at"             timestamp NOT NULL DEFAULT now(),
  "seller_id"            text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "buyer_id"             text REFERENCES "users"("id") ON DELETE SET NULL,
  "product_id"           uuid,
  "variant_id"           uuid,
  "sku"                  text,
  "category_id"          uuid,
  "qty"                  numeric(18,4) NOT NULL DEFAULT 1,
  "unit_price"           numeric(18,2) NOT NULL DEFAULT 0,
  "gross"                numeric(18,2) NOT NULL DEFAULT 0,
  "discount"             numeric(18,2) NOT NULL DEFAULT 0,
  "shipping"             numeric(18,2) NOT NULL DEFAULT 0,
  "platform_fee"         numeric(18,2) NOT NULL DEFAULT 0,
  "fee_dpp"              numeric(18,2) NOT NULL DEFAULT 0,
  "fee_ppn"              numeric(18,2) NOT NULL DEFAULT 0,
  "seller_net"           numeric(18,2) NOT NULL DEFAULT 0,
  "affiliate_user_id"    text REFERENCES "users"("id") ON DELETE SET NULL,
  "affiliate_commission" numeric(18,2) NOT NULL DEFAULT 0,
  "sale_kind"            sale_kind NOT NULL DEFAULT 'AGENT_3P',
  "currency"             text NOT NULL DEFAULT 'IDR',
  "posted_at"            timestamp NOT NULL DEFAULT now(),
  UNIQUE ("order_item_id","event")
);
CREATE INDEX IF NOT EXISTS "idx_sr_seller_time"   ON "sales_register" ("seller_id","event_at");
CREATE INDEX IF NOT EXISTS "idx_sr_category_time" ON "sales_register" ("category_id","event_at") WHERE "category_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_sr_product_time"  ON "sales_register" ("product_id","event_at") WHERE "product_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_sr_journal"       ON "sales_register" ("journal_id") WHERE "journal_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_sr_kind_time"     ON "sales_register" ("sale_kind","event_at");
CREATE INDEX IF NOT EXISTS "idx_sr_affiliate"     ON "sales_register" ("affiliate_user_id") WHERE "affiliate_user_id" IS NOT NULL;

-- ----- 11. accounting_settings (key/value versioned) -----
CREATE TABLE IF NOT EXISTS "accounting_settings" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key"            text NOT NULL,
  "value"          jsonb NOT NULL,
  "scope"          text NOT NULL DEFAULT 'GLOBAL',
  "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
  "effective_to"   date,
  "is_active"      boolean NOT NULL DEFAULT true,
  "notes"          text,
  "updated_by"     text REFERENCES "users"("id") ON DELETE SET NULL,
  "updated_at"     timestamp NOT NULL DEFAULT now(),
  "created_at"     timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_acc_settings_key_scope_eff"
  ON "accounting_settings" ("key","scope","effective_from" DESC);
CREATE INDEX IF NOT EXISTS "idx_acc_settings_active"
  ON "accounting_settings" ("is_active") WHERE "is_active" = true;

-- ----- 12. Materialized view for fast balance reads -----
CREATE MATERIALIZED VIEW IF NOT EXISTS "gl_account_balances" AS
SELECT
  jl.account_id,
  jl.partner_user_id,
  COALESCE(jl.partner_role, '') AS partner_role,
  j.book,
  j.book_owner_id,
  j.period_id,
  SUM(jl.debit)  AS total_debit,
  SUM(jl.credit) AS total_credit,
  SUM(jl.debit) - SUM(jl.credit) AS net_debit
FROM "journal_lines" jl
JOIN "journals" j ON j.id = jl.journal_id
WHERE j.status = 'POSTED'
GROUP BY jl.account_id, jl.partner_user_id, COALESCE(jl.partner_role, ''),
         j.book, j.book_owner_id, j.period_id;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_gl_account_balances"
  ON "gl_account_balances" (account_id, COALESCE(partner_user_id, ''), partner_role, book, COALESCE(book_owner_id, ''), period_id);

-- ============================================================
-- 13. SEED CHART OF ACCOUNTS (§4)
-- ============================================================
INSERT INTO "coa_accounts" ("code","name","class","normal_balance","is_postable","tax_kind","description") VALUES
  -- 1xxxx ASET
  ('11000','Kas & Setara Kas','ASSET','DEBIT', false, NULL, 'Header'),
  ('11100','Kas Operasional (Bank Mandiri OPS)','ASSET','DEBIT', true, NULL, 'Saldo bank operasional'),
  ('11200','Kas Escrow (Bank Mandiri ESCROW)','ASSET','DEBIT', true, NULL, 'Wajib segregated'),
  ('11300','Kas di Payment Gateway (Xendit Pending)','ASSET','DEBIT', true, NULL, 'Selisih PG settle'),
  ('11400','Petty Cash','ASSET','DEBIT', true, NULL, NULL),
  ('12000','Piutang','ASSET','DEBIT', false, NULL, 'Header'),
  ('12100','Piutang Dagang - Seller (Fee Belum Tertagih)','ASSET','DEBIT', true, NULL, NULL),
  ('12200','Piutang PPh 23 (kredit pajak)','ASSET','DEBIT', true, 'PPH_23', 'Bukti potong dari customer korporat'),
  ('12300','Piutang PPN Masukan','ASSET','DEBIT', true, 'PPN_IN', 'Untuk dikreditkan'),
  ('13000','Beban Dibayar di Muka','ASSET','DEBIT', true, NULL, 'Sewa, asuransi'),
  ('14000','Aset Tetap','ASSET','DEBIT', false, NULL, 'Phase 4'),
  ('14100','Akumulasi Penyusutan','ASSET','CREDIT', true, NULL, 'CONTRA-ASSET'),
  -- 2xxxx LIABILITAS
  ('21000','Utang Usaha','LIABILITY','CREDIT', true, NULL, NULL),
  ('22000','Utang ke Seller (Saldo Wallet)','LIABILITY','CREDIT', true, NULL, 'Agregat wallet seller'),
  ('22100','Utang Refund ke Buyer','LIABILITY','CREDIT', true, NULL, NULL),
  ('22200','Utang Komisi Affiliate','LIABILITY','CREDIT', true, NULL, NULL),
  ('23000','Pendapatan Diterima di Muka (Escrow Buyer)','LIABILITY','CREDIT', true, NULL, 'Deferred revenue platform'),
  ('24000','Utang Pajak','LIABILITY','CREDIT', false, NULL, 'Header'),
  ('24100','PPN Keluaran','LIABILITY','CREDIT', true, 'PPN_OUT', 'Atas jasa platform'),
  ('24200','PPh 23 Terutang','LIABILITY','CREDIT', true, 'PPH_23', 'Pemotongan ke vendor'),
  ('24300','PPh 21 Terutang (Karyawan)','LIABILITY','CREDIT', true, 'PPH_21', NULL),
  ('24400','PPh 4(2) Terutang','LIABILITY','CREDIT', true, 'PPH_4_2', NULL),
  ('24500','PPh Final PP 55/2022 (UMKM) Terutang','LIABILITY','CREDIT', true, 'PPH_FINAL_UMKM', NULL),
  ('24600','PPh 25/29 Badan Terutang','LIABILITY','CREDIT', true, 'PPH_25', NULL),
  ('25000','Utang Bank / Pinjaman','LIABILITY','CREDIT', true, NULL, NULL),
  -- 3xxxx EKUITAS
  ('31000','Modal Disetor','EQUITY','CREDIT', true, NULL, NULL),
  ('32000','Saldo Laba','EQUITY','CREDIT', true, NULL, NULL),
  ('33000','Laba Tahun Berjalan','EQUITY','CREDIT', true, NULL, 'Closing target'),
  -- 4xxxx PENDAPATAN
  ('41000','Pendapatan Komisi Marketplace','REVENUE','CREDIT', true, NULL, NULL),
  ('41100','Pendapatan Listing Fee','REVENUE','CREDIT', true, NULL, NULL),
  ('41200','Pendapatan Iklan / Promoted Listing','REVENUE','CREDIT', true, NULL, NULL),
  ('41300','Pendapatan Subscription Seller (Premium)','REVENUE','CREDIT', true, NULL, NULL),
  ('41400','Pendapatan Logistik (Markup Ongkir)','REVENUE','CREDIT', true, NULL, NULL),
  ('41500','Pendapatan Layanan Pembayaran (Convenience Fee)','REVENUE','CREDIT', true, NULL, NULL),
  ('49000','Diskon & Voucher Platform','CONTRA_REVENUE','DEBIT', true, NULL, 'Kontra-pendapatan'),
  -- 5xxxx COGS
  ('51000','Beban Pokok Logistik','COGS','DEBIT', true, NULL, NULL),
  -- 6xxxx OPEX
  ('61000','Beban Gaji & Tunjangan','OPEX','DEBIT', true, NULL, NULL),
  ('61100','Beban THR / Bonus','OPEX','DEBIT', true, NULL, NULL),
  ('62000','Beban Sewa Kantor','OPEX','DEBIT', true, NULL, NULL),
  ('62100','Beban Utilitas','OPEX','DEBIT', true, NULL, NULL),
  ('63000','Beban Hosting / Cloud / SaaS','OPEX','DEBIT', true, NULL, NULL),
  ('63100','Beban Domain & SSL','OPEX','DEBIT', true, NULL, NULL),
  ('64000','Beban Pemasaran & Iklan','OPEX','DEBIT', true, NULL, NULL),
  ('65000','Beban Payment Gateway (Xendit MDR)','OPEX','DEBIT', true, NULL, NULL),
  ('65100','Beban Bank (Admin, Transfer Payout)','OPEX','DEBIT', true, NULL, NULL),
  ('66000','Beban Komisi Affiliate','OPEX','DEBIT', true, NULL, NULL),
  ('67000','Beban Penyusutan','OPEX','DEBIT', true, NULL, NULL),
  ('68000','Beban Profesional (Konsultan, Auditor)','OPEX','DEBIT', true, NULL, NULL),
  ('69000','Beban Lain-lain','OPEX','DEBIT', true, NULL, NULL),
  -- 7xxxx OTHER
  ('71000','Pendapatan Bunga Bank','OTHER_INCOME','CREDIT', true, NULL, NULL),
  ('72000','Selisih Pembulatan','OTHER_INCOME','CREDIT', true, NULL, NULL),
  ('73000','Beban Bunga','OTHER_EXPENSE','DEBIT', true, NULL, NULL),
  ('74000','Kerugian Penghapusan Piutang','OTHER_EXPENSE','DEBIT', true, NULL, NULL),
  -- 8xxxx PAJAK PENGHASILAN
  ('81000','Beban Pajak Penghasilan Kini','TAX_EXPENSE','DEBIT', true, NULL, NULL),
  ('82000','Beban/Manfaat Pajak Tangguhan','TAX_EXPENSE','DEBIT', true, NULL, NULL)
ON CONFLICT ("book","code") DO NOTHING;

-- Auto-create accounting period for current month (PLATFORM)
INSERT INTO "accounting_periods" ("book","year","month","starts_at","ends_at","status")
SELECT 'PLATFORM',
       EXTRACT(YEAR FROM CURRENT_DATE)::int,
       EXTRACT(MONTH FROM CURRENT_DATE)::int,
       date_trunc('month', CURRENT_DATE)::date,
       (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date,
       'OPEN'
ON CONFLICT ("book","year","month") DO NOTHING;

-- ============================================================
-- 14. SEED accounting_settings (§15.2)
-- ============================================================
INSERT INTO "accounting_settings" ("key","value","scope","notes") VALUES
  ('entity.legal_name', '"PT Jual Beli Raket"'::jsonb, 'GLOBAL', 'seed default'),
  ('entity.npwp', '""'::jsonb, 'GLOBAL', NULL),
  ('entity.address', '""'::jsonb, 'GLOBAL', NULL),
  ('entity.fiscal_year_start_month', '1'::jsonb, 'GLOBAL', NULL),
  ('entity.base_currency', '"IDR"'::jsonb, 'GLOBAL', NULL),
  ('entity.is_pkp', 'false'::jsonb, 'GLOBAL', NULL),
  ('entity.pkp_effective_from', 'null'::jsonb, 'GLOBAL', NULL),
  ('entity.house_seller_id', 'null'::jsonb, 'GLOBAL', '1P house account'),
  ('tax.regime', '"UMKM_PP55"'::jsonb, 'GLOBAL', NULL),
  ('tax.ppn_rate', '0.11'::jsonb, 'GLOBAL', NULL),
  ('tax.ppn_method', '"INCLUSIVE"'::jsonb, 'GLOBAL', NULL),
  ('tax.pph23_rate', '0.02'::jsonb, 'GLOBAL', NULL),
  ('tax.pph_final_umkm_rate', '0.005'::jsonb, 'GLOBAL', NULL),
  ('tax.pph_badan_rate', '0.22'::jsonb, 'GLOBAL', NULL),
  ('tax.pmse_enabled', 'false'::jsonb, 'GLOBAL', NULL),
  ('tax.coretax_export_format', '"CSV"'::jsonb, 'GLOBAL', NULL),
  ('logistics.revenue_mode', '"PASS_THROUGH"'::jsonb, 'GLOBAL', NULL),
  ('logistics.default_markup_account_code', '"41400"'::jsonb, 'GLOBAL', NULL),
  ('escrow.segregated_account', 'false'::jsonb, 'GLOBAL', NULL),
  ('escrow.bank_account_id', 'null'::jsonb, 'GLOBAL', NULL),
  ('escrow.auto_release_days', '7'::jsonb, 'GLOBAL', NULL),
  ('currency.allow_multi', 'false'::jsonb, 'GLOBAL', NULL),
  ('currency.allowed_codes', '["IDR"]'::jsonb, 'GLOBAL', NULL),
  ('period.close_deadline_business_days', '5'::jsonb, 'GLOBAL', NULL),
  ('period.auto_lock_after_days', '7'::jsonb, 'GLOBAL', NULL),
  ('period.allow_reopen', 'true'::jsonb, 'GLOBAL', NULL),
  ('audit.retention_years', '10'::jsonb, 'GLOBAL', NULL),
  ('audit.archive_storage', '"s3://jbr-archive/gl"'::jsonb, 'GLOBAL', NULL),
  ('audit.hash_chain_enabled', 'false'::jsonb, 'GLOBAL', NULL),
  ('gl.dual_write_legacy', 'true'::jsonb, 'GLOBAL', NULL),
  ('gl.recon_alert_threshold_idr', '1'::jsonb, 'GLOBAL', NULL),
  ('posting.rounding_strategy', '"HALF_EVEN"'::jsonb, 'GLOBAL', NULL),
  ('posting.default_book', '"PLATFORM"'::jsonb, 'GLOBAL', NULL),
  ('seller_subledger.enabled', 'true'::jsonb, 'GLOBAL', NULL),
  ('report.balance_sheet_template', '"PSAK1_CLASSIFIED"'::jsonb, 'GLOBAL', NULL),
  ('report.profit_loss_classification', '"BY_FUNCTION"'::jsonb, 'GLOBAL', NULL),
  ('report.cash_flow_method', '"INDIRECT"'::jsonb, 'GLOBAL', NULL),
  ('notification.finance_alert_emails', '[]'::jsonb, 'GLOBAL', NULL),
  ('affiliate.commission_account_code', '"66000"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.payable_account_code', '"22200"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.default_rate_pct', '2.0'::jsonb, 'GLOBAL', NULL),
  ('affiliate.commission_base', '"NET_OF_FEE"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.withholding_kind', '"PPH_21"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.withholding_rate', '0.025'::jsonb, 'GLOBAL', NULL),
  ('affiliate.attribution_window_days', '30'::jsonb, 'GLOBAL', NULL),
  ('affiliate.approval_delay_days', '7'::jsonb, 'GLOBAL', NULL),
  ('affiliate.minimum_payout_idr', '50000'::jsonb, 'GLOBAL', NULL),
  ('affiliate.payout_schedule', '"MONTHLY"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.clawback_policy', '"OFFSET_NEXT"'::jsonb, 'GLOBAL', NULL),
  ('affiliate.allow_self_referral', 'false'::jsonb, 'GLOBAL', NULL),
  ('catalog.sku_required_for_new_products', 'false'::jsonb, 'GLOBAL', NULL),
  ('catalog.sku_format_regex', '""'::jsonb, 'GLOBAL', NULL),
  ('catalog.global_master_catalog_enabled', 'false'::jsonb, 'GLOBAL', NULL),
  ('firstparty.enabled', 'false'::jsonb, 'GLOBAL', NULL),
  ('firstparty.cost_method', '"WEIGHTED_AVG"'::jsonb, 'GLOBAL', NULL),
  ('firstparty.default_revenue_account_code', '"41600"'::jsonb, 'GLOBAL', NULL),
  ('firstparty.default_cogs_account_code', '"51100"'::jsonb, 'GLOBAL', NULL),
  ('firstparty.default_inventory_account_code', '"13100"'::jsonb, 'GLOBAL', NULL),
  ('firstparty.allow_negative_stock', 'false'::jsonb, 'GLOBAL', NULL),
  ('firstparty.shrinkage_account_code', '"51300"'::jsonb, 'GLOBAL', NULL),
  ('seller_export.signed_url_ttl_minutes', '15'::jsonb, 'GLOBAL', NULL),
  ('seller_export.file_retention_days', '7'::jsonb, 'GLOBAL', NULL),
  ('seller_export.max_period_days', '366'::jsonb, 'GLOBAL', NULL),
  ('seller_export.max_concurrent_jobs_per_seller', '3'::jsonb, 'GLOBAL', NULL),
  ('seller_export.pdf_signing_enabled', 'false'::jsonb, 'GLOBAL', NULL),
  ('seller_export.verify_endpoint_enabled', 'true'::jsonb, 'GLOBAL', NULL),
  ('security.rls_enabled', 'false'::jsonb, 'GLOBAL', 'enable in Phase 3 hardening'),
  ('security.leak_detector_cron', '"0 2 * * *"'::jsonb, 'GLOBAL', NULL)
ON CONFLICT DO NOTHING;
