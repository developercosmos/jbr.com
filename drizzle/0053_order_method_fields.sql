-- Fulfillment redesign Fase 2: rekam metode pengiriman + metode pembayaran pada order.
-- shipping_method: REGULAR | INSTANT (kecepatan kurir; COD ditangani via payment_method).
-- payment_method:  BANK_TRANSFER | EWALLET | COD (sebelumnya tidak tersimpan sama sekali).
-- Kolom text + default agar order lama tetap valid; validasi nilai di level aplikasi.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method" text NOT NULL DEFAULT 'REGULAR';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" text NOT NULL DEFAULT 'BANK_TRANSFER';
