ALTER TABLE "trading_catalog" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "trading_catalog" ADD CONSTRAINT "trading_catalog_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trading_catalog_warehouse_idx" ON "trading_catalog" USING btree ("warehouse_id");--> statement-breakpoint
UPDATE "trading_catalog" tc
SET "warehouse_id" = (
  SELECT w."id" FROM "warehouses" w
  WHERE w."company_id" = tc."company_id"
  ORDER BY w."created_at", w."id"
  LIMIT 1
)
WHERE tc."warehouse_id" IS NULL;
