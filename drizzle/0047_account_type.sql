-- Tipe akun saat registrasi: PERSONAL (default) | COMPANY.
-- Akun COMPANY diarahkan & di-enforce melengkapi verifikasi KYC T2 (dokumen
-- bisnis) sebelum dapat menerbitkan produk.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" text DEFAULT 'PERSONAL' NOT NULL;
