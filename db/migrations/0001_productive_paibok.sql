CREATE TYPE "public"."wms_bin_status" AS ENUM('empty', 'partial', 'full', 'reserved', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."wms_container_type" AS ENUM('pallet', 'box', 'roll', 'drum', 'bundle');--> statement-breakpoint
CREATE TYPE "public"."wms_map_element_type" AS ENUM('rack', 'zone', 'aisle', 'gate', 'pillar', 'wall');--> statement-breakpoint
CREATE TYPE "public"."wms_rack_type" AS ENUM('pallet', 'shelf', 'cantilever', 'roll_stand', 'floor_stack', 'obstacle', 'gate');--> statement-breakpoint
CREATE TYPE "public"."wms_zone_type" AS ENUM('storage', 'receiving', 'shipping', 'staging', 'quarantine');--> statement-breakpoint
ALTER TYPE "public"."work_order_status" ADD VALUE 'In Production' BEFORE 'Completed';--> statement-breakpoint
CREATE TABLE "crm_industries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"code" varchar(64),
	"name" varchar(128) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carriers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(64) DEFAULT 'fleet' NOT NULL,
	"vehicle_model" varchar(128),
	"vehicle_no" varchar(64),
	"driver_name" varchar(255),
	"driver_phone" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_bin_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"rack_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"stock_balance_id" uuid,
	"finished_good_id" uuid,
	"item_id" uuid,
	"sku" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" varchar(64) DEFAULT 'Paper & Board' NOT NULL,
	"batch_number" varchar(64),
	"work_order_id" varchar(128),
	"quantity" numeric(15, 3) NOT NULL,
	"reserved_qty" numeric(15, 3) DEFAULT '0' NOT NULL,
	"unit" varchar(32) DEFAULT 'sheets' NOT NULL,
	"weight_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"container_type" "wms_container_type" DEFAULT 'pallet' NOT NULL,
	"pos_x" double precision DEFAULT 10 NOT NULL,
	"pos_y" double precision DEFAULT 10 NOT NULL,
	"width_px" double precision DEFAULT 80 NOT NULL,
	"height_px" double precision DEFAULT 80 NOT NULL,
	"color" varchar(32) DEFAULT '#3b82f6',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_bins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"rack_id" uuid NOT NULL,
	"zone_id" uuid,
	"code" varchar(64) NOT NULL,
	"barcode" varchar(64),
	"level" integer NOT NULL,
	"bay" integer NOT NULL,
	"row_span" integer DEFAULT 1 NOT NULL,
	"col_span" integer DEFAULT 1 NOT NULL,
	"width_cm" numeric(10, 2) DEFAULT '120' NOT NULL,
	"height_cm" numeric(10, 2) DEFAULT '150' NOT NULL,
	"depth_cm" numeric(10, 2) DEFAULT '100' NOT NULL,
	"max_weight_kg" numeric(10, 2) DEFAULT '1000' NOT NULL,
	"current_weight_kg" numeric(10, 2) DEFAULT '0' NOT NULL,
	"occupancy_pct" integer DEFAULT 0 NOT NULL,
	"status" "wms_bin_status" DEFAULT 'empty' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"zone_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "wms_rack_type" DEFAULT 'pallet' NOT NULL,
	"x" double precision DEFAULT 100 NOT NULL,
	"y" double precision DEFAULT 100 NOT NULL,
	"width" double precision DEFAULT 240 NOT NULL,
	"depth" double precision DEFAULT 80 NOT NULL,
	"rotation" double precision DEFAULT 0 NOT NULL,
	"levels_count" integer DEFAULT 4 NOT NULL,
	"bays_count" integer DEFAULT 6 NOT NULL,
	"max_weight_kg" numeric(12, 2) DEFAULT '10000' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"visual_config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wms_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "wms_zone_type" DEFAULT 'storage' NOT NULL,
	"color" varchar(32) DEFAULT '#3b82f6' NOT NULL,
	"x" double precision DEFAULT 0 NOT NULL,
	"y" double precision DEFAULT 0 NOT NULL,
	"width" double precision DEFAULT 400 NOT NULL,
	"height" double precision DEFAULT 300 NOT NULL,
	"rotation" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "legal_type" varchar(32) DEFAULT 'MChJ' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "is_vat_payer" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "vat_number" varchar(64);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "bank_name" varchar(255);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "bank_account" varchar(64);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "mfo" varchar(16);--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "annual_limit_uzs" numeric(18, 2) DEFAULT '1000000000.00';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" varchar(32) DEFAULT 'Active' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "industry_id" uuid;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "production_machines" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "production_machines" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "order_date" varchar(32);--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "actual_end_date" varchar(32);--> statement-breakpoint
ALTER TABLE "crm_industries" ADD CONSTRAINT "crm_industries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carriers" ADD CONSTRAINT "carriers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_rack_id_wms_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."wms_racks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_bin_id_wms_bins_id_fk" FOREIGN KEY ("bin_id") REFERENCES "public"."wms_bins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_stock_balance_id_warehouse_stock_balances_id_fk" FOREIGN KEY ("stock_balance_id") REFERENCES "public"."warehouse_stock_balances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_finished_good_id_warehouse_finished_goods_id_fk" FOREIGN KEY ("finished_good_id") REFERENCES "public"."warehouse_finished_goods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bin_items" ADD CONSTRAINT "wms_bin_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bins" ADD CONSTRAINT "wms_bins_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bins" ADD CONSTRAINT "wms_bins_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bins" ADD CONSTRAINT "wms_bins_rack_id_wms_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."wms_racks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_bins" ADD CONSTRAINT "wms_bins_zone_id_wms_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."wms_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_racks" ADD CONSTRAINT "wms_racks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_racks" ADD CONSTRAINT "wms_racks_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_racks" ADD CONSTRAINT "wms_racks_zone_id_wms_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."wms_zones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_zones" ADD CONSTRAINT "wms_zones_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wms_zones" ADD CONSTRAINT "wms_zones_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_industries_name_uq" ON "crm_industries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "crm_industries_company_idx" ON "crm_industries" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "crm_industries_is_active_idx" ON "crm_industries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "carriers_company_idx" ON "carriers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "carriers_name_idx" ON "carriers" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "wms_bin_items_bin_idx" ON "wms_bin_items" USING btree ("bin_id");--> statement-breakpoint
CREATE INDEX "wms_bin_items_sku_idx" ON "wms_bin_items" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "wms_bin_items_stock_balance_idx" ON "wms_bin_items" USING btree ("stock_balance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wms_bins_warehouse_code_uq" ON "wms_bins" USING btree ("warehouse_id","code");--> statement-breakpoint
CREATE INDEX "wms_bins_rack_idx" ON "wms_bins" USING btree ("rack_id");--> statement-breakpoint
CREATE INDEX "wms_bins_status_idx" ON "wms_bins" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wms_racks_warehouse_code_uq" ON "wms_racks" USING btree ("warehouse_id","code");--> statement-breakpoint
CREATE INDEX "wms_racks_warehouse_idx" ON "wms_racks" USING btree ("warehouse_id");--> statement-breakpoint
CREATE INDEX "wms_racks_zone_idx" ON "wms_racks" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wms_zones_warehouse_code_uq" ON "wms_zones" USING btree ("warehouse_id","code");--> statement-breakpoint
CREATE INDEX "wms_zones_warehouse_idx" ON "wms_zones" USING btree ("warehouse_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_industry_id_crm_industries_id_fk" FOREIGN KEY ("industry_id") REFERENCES "public"."crm_industries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_machines" ADD CONSTRAINT "production_machines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "companies_legal_type_idx" ON "companies" USING btree ("legal_type");--> statement-breakpoint
CREATE INDEX "work_orders_order_date_idx" ON "work_orders" USING btree ("order_date");