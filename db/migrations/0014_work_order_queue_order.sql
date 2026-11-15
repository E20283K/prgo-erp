ALTER TABLE "work_orders" ADD COLUMN "queue_order" integer;--> statement-breakpoint
-- Existing orders keep their current order: oldest first within each company.
UPDATE "work_orders" wo SET "queue_order" = ranked.rn
FROM (SELECT "id", row_number() OVER (PARTITION BY "company_id" ORDER BY "created_at") * 10 AS rn FROM "work_orders") ranked
WHERE wo."id" = ranked."id" AND wo."queue_order" IS NULL;
