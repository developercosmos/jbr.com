-- Kerangka pajak marketplace PMK 37/2025.
-- - seller_tax_profiles: NPWP/NIK + alamat korespondensi (kewajiban data pedagang
--   dalam negeri), pernyataan omzet <= Rp500jt per tahun pajak, pelaporan saat
--   omzet melewati Rp500jt, dan status PKP.
-- - tax_withholdings: catatan pungutan PPh 22 (0,5% peredaran bruto) per order
--   yang selesai — menjadi dasar bukti pungut (dokumen tagihan marketplace
--   dipersamakan dengan bukti pemungutan PPh 22).
-- - CoA 24700: akun utang PPh 22 marketplace (slot mapping "wht_pph22").
-- Konfigurasi via accounting_settings (default di kode):
--   tax.pph22_enabled (false sampai JBR ditunjuk DJP), tax.pph22_rate (0.005),
--   tax.pph22_omzet_threshold (500000000), kyc.tier_cap_t0/t1/t2.

CREATE TABLE IF NOT EXISTS "seller_tax_profiles" (
    "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
    "tax_id_kind" text, -- 'NPWP' | 'NIK'
    "npwp" text, -- terenkripsi (PDP); NIK bersumber dari seller_kyc.nik
    "correspondence_address" text,
    "pkp" boolean DEFAULT false NOT NULL,
    "omzet_declared_year" integer, -- tahun pajak pernyataan omzet <= 500jt
    "omzet_declared_at" timestamp,
    "crossed_declared_year" integer, -- tahun pajak pelaporan omzet > 500jt
    "crossed_declared_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "tax_withholdings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id"),
    "seller_id" text NOT NULL REFERENCES "users"("id"),
    "tax_year" integer NOT NULL,
    "base_gross" numeric(14,2) NOT NULL,
    "rate" numeric(6,4) NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    "journal_id" uuid,
    "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_tax_withholdings_seller_year" ON "tax_withholdings" ("seller_id", "tax_year");

INSERT INTO "coa_accounts" ("code","name","class","normal_balance","is_postable","tax_kind","description") VALUES
  ('24700','PPh 22 Terutang (Marketplace PMK 37/2025)','LIABILITY','CREDIT', true, 'PPH_22', 'Pungutan 0,5% peredaran bruto seller')
ON CONFLICT ("book","code") DO NOTHING;
