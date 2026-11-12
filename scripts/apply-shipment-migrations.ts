import { db } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying pending migrations to Postgres...");

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."warehouse_manifest_status" AS ENUM('Draft', 'Loading', 'Dispatched', 'Delivered', 'Cancelled');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "warehouse_dispatch_manifests" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "company_id" uuid NOT NULL REFERENCES "public"."companies"("id") ON DELETE restrict,
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

    CREATE UNIQUE INDEX IF NOT EXISTS "manifests_company_number_uq" 
    ON "warehouse_dispatch_manifests" ("company_id", "manifest_number");
    CREATE INDEX IF NOT EXISTS "manifests_company_date_idx" 
    ON "warehouse_dispatch_manifests" ("company_id", "manifest_date");
    CREATE INDEX IF NOT EXISTS "manifests_status_idx" 
    ON "warehouse_dispatch_manifests" ("company_id", "status");
  `);

  await db.execute(sql`
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "trading_sale_id" varchar(128);
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "manifest_id" uuid REFERENCES "warehouse_dispatch_manifests"("id") ON DELETE set null;
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "origin_source" varchar(64) DEFAULT 'WorkOrder' NOT NULL;

    ALTER TABLE "warehouse_shipment_items" ADD COLUMN IF NOT EXISTS "finished_good_id" uuid;
    ALTER TABLE "warehouse_shipment_items" ADD COLUMN IF NOT EXISTS "trading_catalog_id" varchar(128);
    ALTER TABLE "warehouse_shipment_items" ADD COLUMN IF NOT EXISTS "account_code" varchar(16) DEFAULT '2810' NOT NULL;
    ALTER TABLE "warehouse_shipment_items" ADD COLUMN IF NOT EXISTS "source_work_order_id" varchar(64);

    ALTER TABLE "warehouse_finished_goods" ADD COLUMN IF NOT EXISTS "allocation_status" varchar(32) DEFAULT 'Dedicated' NOT NULL;
    ALTER TABLE "warehouse_finished_goods" ADD COLUMN IF NOT EXISTS "receipt_status" varchar(32) DEFAULT 'Received' NOT NULL;
    ALTER TABLE "warehouse_finished_goods" ADD COLUMN IF NOT EXISTS "cost_price_per_unit" numeric(15, 2) DEFAULT '0' NOT NULL;
    ALTER TABLE "warehouse_finished_goods" ADD COLUMN IF NOT EXISTS "total_stock_value" numeric(15, 2) DEFAULT '0' NOT NULL;

    ALTER TABLE "warehouse_receipt_items" ADD COLUMN IF NOT EXISTS "finished_good_id" uuid REFERENCES "warehouse_finished_goods"("id") ON DELETE set null;
    ALTER TABLE "warehouse_receipt_items" ADD COLUMN IF NOT EXISTS "source_work_order_id" varchar(128);

    ALTER TABLE "trading_sales" ADD COLUMN IF NOT EXISTS "linked_shipment_id" varchar(128);
  `);

  console.log("Migrations successfully applied!");
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
