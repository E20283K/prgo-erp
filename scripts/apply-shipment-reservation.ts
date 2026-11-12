/**
 * P1: Chiqim rezervatsiyasi va storno uchun schema o'zgarishlarini idempotent tatbiq qilish.
 * Manba: db/migrations/0005_shipment_reservation.sql (db:push bilan yuritilgan bazalar uchun).
 *
 *   npx tsx scripts/apply-shipment-reservation.ts
 */
import "dotenv/config";
import { db, pgClient } from "@/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Applying shipment reservation schema changes...");

  // ALTER TYPE ... ADD VALUE tranzaksiya blokidan tashqarida bajarilishi kerak — har biri alohida so'rov
  await db.execute(sql`ALTER TYPE "public"."warehouse_shipment_status" ADD VALUE IF NOT EXISTS 'Reserved' BEFORE 'Packed'`);
  await db.execute(sql`ALTER TYPE "public"."warehouse_shipment_status" ADD VALUE IF NOT EXISTS 'Picking' BEFORE 'Packed'`);
  await db.execute(sql`ALTER TYPE "public"."finance_delivery_act_status" ADD VALUE IF NOT EXISTS 'cancelled'`);

  await db.execute(sql`
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "reserved_at" timestamp with time zone;
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "dispatched_at" timestamp with time zone;
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp with time zone;
    ALTER TABLE "warehouse_shipments" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
    ALTER TABLE "trading_catalog" ADD COLUMN IF NOT EXISTS "reserved_qty" numeric(14, 3) DEFAULT '0.000' NOT NULL;
  `);

  console.log("Shipment reservation schema applied.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
