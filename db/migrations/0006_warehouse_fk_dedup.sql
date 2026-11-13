-- scripts/apply-shipment-migrations.ts "ADD COLUMN ... REFERENCES" orqali qo'shilgan takroriy FK cheklovlari.
-- Drizzle o'zining *_fk cheklovini allaqachon yaratgan; har bir yozuvda ikki marta tekshiruv bo'lmasligi uchun dublikatlarni olib tashlaymiz.
ALTER TABLE "warehouse_shipments" DROP CONSTRAINT IF EXISTS "warehouse_shipments_manifest_id_fkey";--> statement-breakpoint
ALTER TABLE "warehouse_receipt_items" DROP CONSTRAINT IF EXISTS "warehouse_receipt_items_finished_good_id_fkey";--> statement-breakpoint
ALTER TABLE "warehouse_dispatch_manifests" DROP CONSTRAINT IF EXISTS "warehouse_dispatch_manifests_company_id_fkey";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipments_manifest_idx" ON "warehouse_shipments" USING btree ("manifest_id");
