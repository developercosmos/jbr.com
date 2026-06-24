-- Fulfillment redesign Fase 1: tambah status PACKING (Dikemas) ke siklus pesanan.
-- Alur: PAID -> PACKING -> PROCESSING -> SHIPPED -> DELIVERED -> COMPLETED.
-- ALTER TYPE ... ADD VALUE tidak boleh dalam transaksi; run_migrations memakai
-- `psql -f` (auto-commit per statement) sehingga ini aman dijalankan apa adanya.
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'PACKING' AFTER 'PAID';
