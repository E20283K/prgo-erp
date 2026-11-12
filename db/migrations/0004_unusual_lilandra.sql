CREATE TYPE "public"."warehouse_manifest_status" AS ENUM('Draft', 'Loading', 'Dispatched', 'Delivered', 'Cancelled');--> statement-breakpoint
CREATE TABLE "warehouse_dispatch_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"manifest_number" varchar(64) NOT NULL,
	"manifest_date" timestamp with time zone DEFAULT now() NOT NULL,
	"vehicle_plate" varchar(64),
	"vehicle_model" varchar(128),
	"driver_name" varchar(255),
	"driver_phone" varchar(64),
	"destination_route" text,
	"status" "warehouse_manifest_status" DEFAULT 'Draft' NOT NULL,
	"total_shipments_count" integer DEFAULT 0 NOT NULL,
	"total_packages" integer DEFAULT 0 NOT NULL,
	"total_weight_kg" numeric(12, 2) DEFAULT '0' NOT NULL,
	"departure_time" varchar(32),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_catalog_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"catalog_id" uuid NOT NULL,
	"image_url" text NOT NULL,
	"thumbnail_url" text,
	"title" varchar(255),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "delivery_batches" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "telegram_meta" jsonb;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD COLUMN "allocation_status" varchar(32) DEFAULT 'Dedicated' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD COLUMN "receipt_status" varchar(32) DEFAULT 'Received' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD COLUMN "cost_price_per_unit" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_finished_goods" ADD COLUMN "total_stock_value" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" ADD COLUMN "finished_good_id" uuid;--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" ADD COLUMN "source_work_order_id" varchar(128);--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD COLUMN "finished_good_id" uuid;--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD COLUMN "trading_catalog_id" varchar(128);--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD COLUMN "account_code" varchar(16) DEFAULT '2810' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_shipment_items" ADD COLUMN "source_work_order_id" varchar(64);--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "trading_sale_id" varchar(128);--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "manifest_id" uuid;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "origin_source" varchar(64) DEFAULT 'WorkOrder' NOT NULL;--> statement-breakpoint
ALTER TABLE "trading_catalog" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "trading_sales" ADD COLUMN "linked_shipment_id" varchar(128);--> statement-breakpoint
ALTER TABLE "warehouse_dispatch_manifests" ADD CONSTRAINT "warehouse_dispatch_manifests_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_catalog_images" ADD CONSTRAINT "trading_catalog_images_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_catalog_images" ADD CONSTRAINT "trading_catalog_images_catalog_id_trading_catalog_id_fk" FOREIGN KEY ("catalog_id") REFERENCES "public"."trading_catalog"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manifests_company_number_uq" ON "warehouse_dispatch_manifests" USING btree ("company_id","manifest_number");--> statement-breakpoint
CREATE INDEX "manifests_company_date_idx" ON "warehouse_dispatch_manifests" USING btree ("company_id","manifest_date");--> statement-breakpoint
CREATE INDEX "manifests_status_idx" ON "warehouse_dispatch_manifests" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "trading_catalog_images_catalog_idx" ON "trading_catalog_images" USING btree ("catalog_id");--> statement-breakpoint
CREATE INDEX "trading_catalog_images_company_idx" ON "trading_catalog_images" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" ADD CONSTRAINT "warehouse_receipt_items_finished_good_id_warehouse_finished_goods_id_fk" FOREIGN KEY ("finished_good_id") REFERENCES "public"."warehouse_finished_goods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD CONSTRAINT "warehouse_shipments_manifest_id_warehouse_dispatch_manifests_id_fk" FOREIGN KEY ("manifest_id") REFERENCES "public"."warehouse_dispatch_manifests"("id") ON DELETE set null ON UPDATE no action;