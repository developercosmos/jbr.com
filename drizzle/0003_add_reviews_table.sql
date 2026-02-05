CREATE TYPE "public"."dispute_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('OPEN', 'IN_PROGRESS', 'AWAITING_RESPONSE', 'RESOLVED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."dispute_type" AS ENUM('ITEM_NOT_AS_DESCRIBED', 'ITEM_NOT_RECEIVED', 'REFUND_REQUEST', 'SELLER_NOT_RESPONSIVE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."file_type" AS ENUM('image', 'video', 'audio', 'document', 'other');--> statement-breakpoint
CREATE TYPE "public"."storage_type" AS ENUM('local', 's3');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('ACCOUNT', 'PAYMENT', 'SHIPPING', 'VERIFICATION', 'SECURITY', 'TECHNICAL', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('OPEN', 'PENDING', 'IN_PROGRESS', 'CLOSED');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"reporter_id" text NOT NULL,
	"reported_id" text NOT NULL,
	"dispute_number" text NOT NULL,
	"type" "dispute_type" NOT NULL,
	"priority" "dispute_priority" DEFAULT 'NORMAL' NOT NULL,
	"status" "dispute_status" DEFAULT 'OPEN' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"amount" numeric(12, 2),
	"evidence_images" jsonb DEFAULT '[]'::jsonb,
	"resolution" text,
	"resolved_at" timestamp,
	"resolved_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "disputes_dispute_number_unique" UNIQUE("dispute_number")
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_type" "file_type" NOT NULL,
	"size" integer NOT NULL,
	"storage_type" "storage_type" NOT NULL,
	"storage_key" text NOT NULL,
	"folder" text DEFAULT 'general',
	"tags" text[],
	"alt_text" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"credentials" jsonb,
	"config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "integration_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_id" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"message" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"ticket_number" text NOT NULL,
	"category" "ticket_category" NOT NULL,
	"status" "ticket_status" DEFAULT 'OPEN' NOT NULL,
	"priority" "dispute_priority" DEFAULT 'NORMAL' NOT NULL,
	"subject" text NOT NULL,
	"assigned_to" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_reported_id_users_id_fk" FOREIGN KEY ("reported_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_disputes_order_id" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_reporter_id" ON "disputes" USING btree ("reporter_id");--> statement-breakpoint
CREATE INDEX "idx_disputes_status" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_files_folder" ON "files" USING btree ("folder");--> statement-breakpoint
CREATE INDEX "idx_files_file_type" ON "files" USING btree ("file_type");--> statement-breakpoint
CREATE INDEX "idx_files_uploaded_by" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_integration_settings_key" ON "integration_settings" USING btree ("key");--> statement-breakpoint
CREATE INDEX "idx_integration_settings_category" ON "integration_settings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_messages_ticket_id" ON "support_messages" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_user_id" ON "support_tickets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_support_tickets_status" ON "support_tickets" USING btree ("status");