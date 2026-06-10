-- Surat Pernyataan affiliate pindah ke penyimpanan privat (paritas dengan KTP):
-- statement_file_id -> baris files (is_public=false, diakses via /api/files/[id]).
-- statement_url dipertahankan hanya untuk baris lama sampai skrip migrasi
-- scripts/migrate-affiliate-private-docs.mjs dijalankan di server.
ALTER TABLE "affiliate_accounts" ADD COLUMN IF NOT EXISTS "statement_file_id" uuid REFERENCES "files"("id") ON DELETE SET NULL;
