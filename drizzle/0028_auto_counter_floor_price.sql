ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "floor_price" numeric(12, 2);

ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "root_offer_id" uuid;
ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "is_auto_counter" boolean NOT NULL DEFAULT false;

UPDATE "offers"
SET "root_offer_id" = "id"
WHERE "root_offer_id" IS NULL AND "parent_offer_id" IS NULL;

WITH RECURSIVE offer_roots AS (
    SELECT o.id, o.parent_offer_id, o.id AS root_id
    FROM "offers" o
    WHERE o.parent_offer_id IS NULL

    UNION ALL

    SELECT child.id, child.parent_offer_id, roots.root_id
    FROM "offers" child
    JOIN offer_roots roots ON child.parent_offer_id = roots.id
)
UPDATE "offers" o
SET "root_offer_id" = roots.root_id
FROM offer_roots roots
WHERE o.id = roots.id
  AND o.root_offer_id IS NULL;

UPDATE "offers"
SET "root_offer_id" = "id"
WHERE "root_offer_id" IS NULL;

ALTER TABLE "offers" ALTER COLUMN "root_offer_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_offers_root_offer" ON "offers" ("root_offer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_offers_auto_counter_per_thread"
    ON "offers" ("root_offer_id")
    WHERE "is_auto_counter" = true;
