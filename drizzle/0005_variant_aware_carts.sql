ALTER TABLE "carts" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_quote_at" timestamp;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
DROP INDEX IF EXISTS "idx_carts_user_product";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_carts_user_product_variant" ON "carts" USING btree ("user_id","product_id","variant_id");