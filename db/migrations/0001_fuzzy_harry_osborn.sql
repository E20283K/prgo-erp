CREATE TYPE "public"."item_type" AS ENUM('raw_material', 'semi_finished', 'finished_good', 'service', 'consumable');--> statement-breakpoint
CREATE TYPE "public"."die_shape" AS ENUM('rectangle', 'rounded_rect', 'circle', 'oval', 'custom');--> statement-breakpoint
CREATE TYPE "public"."die_type" AS ENUM('rotary_magnetic', 'solid_rotary', 'flatbed', 'hot_stamp', 'embossing');--> statement-breakpoint
CREATE TYPE "public"."machine_status" AS ENUM('active', 'maintenance', 'idle');--> statement-breakpoint
CREATE TYPE "public"."tooling_status" AS ENUM('available', 'in_use', 'sharpening', 'retired');--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"item_type" "item_type" DEFAULT 'raw_material' NOT NULL,
	"category" varchar(64) NOT NULL,
	"unit_id" uuid NOT NULL,
	"description" text,
	"min_stock" numeric(12, 3) DEFAULT '0' NOT NULL,
	"standard_cost" numeric(15, 2) DEFAULT '0' NOT NULL,
	"selling_price" numeric(15, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'UZS' NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(16) NOT NULL,
	"name" varchar(64) NOT NULL,
	"short_name" varchar(16) NOT NULL,
	"international_code" varchar(16),
	"precision" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dies_tooling" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"die_type" "die_type" DEFAULT 'rotary_magnetic' NOT NULL,
	"shape" "die_shape" DEFAULT 'rectangle' NOT NULL,
	"width_mm" numeric(8, 2) NOT NULL,
	"height_mm" numeric(8, 2) NOT NULL,
	"corner_radius_mm" numeric(6, 2) DEFAULT '0' NOT NULL,
	"across_count" integer DEFAULT 1 NOT NULL,
	"around_count" integer DEFAULT 1 NOT NULL,
	"gap_x_mm" numeric(6, 2) DEFAULT '3.0' NOT NULL,
	"gap_y_mm" numeric(6, 2) DEFAULT '3.0' NOT NULL,
	"repeat_length_mm" numeric(8, 3),
	"cylinder_teeth" integer,
	"location" varchar(64),
	"status" "tooling_status" DEFAULT 'available' NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"max_impressions" integer,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flexo_cylinders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"machine_id" uuid,
	"teeth" integer NOT NULL,
	"pitch_circle_diameter" numeric(8, 3) NOT NULL,
	"plate_thickness" numeric(6, 3) NOT NULL,
	"cylinder_diameter" numeric(8, 3) NOT NULL,
	"filmLength" numeric(8, 3) NOT NULL,
	"printing_length" numeric(8, 3) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"location" varchar(64),
	"status" varchar(32) DEFAULT 'ready' NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"verification_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flexo_machines" (
	"128" varchar(128) NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(32) NOT NULL,
	"name" varchar(255) NOT NULL,
	"gear_system" varchar(128) NOT NULL,
	"gear_pitch" numeric(8, 4),
	"min_web_width" numeric(8, 2) NOT NULL,
	"max_web_width" numeric(8, 2) NOT NULL,
	"max_print_width" numeric(8, 2) NOT NULL,
	"standard_plate_thickness" numeric(6, 3) DEFAULT '1.700' NOT NULL,
	"color_stations" integer DEFAULT 4 NOT NULL,
	"speed_mpm" numeric(8, 2) DEFAULT '80' NOT NULL,
	"status" "machine_status" DEFAULT 'active' NOT NULL,
	"hourly_rate" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantone_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"hex" varchar(16) NOT NULL,
	"category" varchar(64) NOT NULL,
	"cmyk_estimate" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_units_of_measure_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD CONSTRAINT "dies_tooling_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_cylinders" ADD CONSTRAINT "flexo_cylinders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_cylinders" ADD CONSTRAINT "flexo_cylinders_machine_id_flexo_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."flexo_machines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_machines" ADD CONSTRAINT "flexo_machines_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexo_machines" ADD CONSTRAINT "flexo_machines_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "items_company_code_uq" ON "items" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "items_company_category_idx" ON "items" USING btree ("company_id","category");--> statement-breakpoint
CREATE INDEX "items_company_item_type_idx" ON "items" USING btree ("company_id","item_type");--> statement-breakpoint
CREATE UNIQUE INDEX "units_code_uq" ON "units_of_measure" USING btree ("code");--> statement-breakpoint
CREATE INDEX "units_is_active_idx" ON "units_of_measure" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "dies_tooling_company_code_uq" ON "dies_tooling" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "dies_tooling_company_shape_idx" ON "dies_tooling" USING btree ("company_id","shape");--> statement-breakpoint
CREATE INDEX "dies_tooling_status_idx" ON "dies_tooling" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "flexo_cylinders_teeth_uq" ON "flexo_cylinders" USING btree ("company_id","machine_id","teeth","plate_thickness");--> statement-breakpoint
CREATE INDEX "flexo_cylinders_teeth_idx" ON "flexo_cylinders" USING btree ("teeth");--> statement-breakpoint
CREATE INDEX "flexo_cylinders_machine_idx" ON "flexo_cylinders" USING btree ("machine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "flexo_machines_company_code_uq" ON "flexo_machines" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "flexo_machines_company_idx" ON "flexo_machines" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "flexo_machines_status_idx" ON "flexo_machines" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pantone_code_uq" ON "pantone_colors" USING btree ("code");--> statement-breakpoint
CREATE INDEX "pantone_category_idx" ON "pantone_colors" USING btree ("category");--> statement-breakpoint
CREATE INDEX "pantone_name_idx" ON "pantone_colors" USING btree ("name");