-- Biteship shipping integration (rates + pickup booking + webhook tracking).
-- - orders.biteship_order_id: the Biteship order id returned by POST /v1/orders;
--   webhook events are matched to our orders through it.
-- - integration_settings row "biteship": admin-togglable provider option, parity
--   with the existing "rajaongkir" row. Biteship wins when both are enabled.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "biteship_order_id" text;
CREATE INDEX IF NOT EXISTS "idx_orders_biteship_order_id" ON "orders" ("biteship_order_id");

INSERT INTO "integration_settings" ("key", "name", "description", "category", "enabled", "credentials", "config")
VALUES (
    'biteship',
    'Biteship',
    'Agregator pengiriman: cek tarif 30+ kurir, booking pickup, dan tracking real-time via webhook. Jika RajaOngkir juga aktif, Biteship yang dipakai.',
    'shipping',
    false,
    '{"api_key": "", "webhook_token": ""}',
    '{"base_url": "https://api.biteship.com", "couriers": "jne,jnt,sicepat,anteraja", "origin_postal_code": "", "origin_latitude": "", "origin_longitude": "", "origin_contact_name": "", "origin_contact_phone": "", "origin_address": "", "fallback_cost": 20000}'
)
ON CONFLICT ("key") DO NOTHING;
