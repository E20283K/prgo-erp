ALTER TABLE "supplier_orders" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
UPDATE "supplier_orders" SET "received_at" = "updated_at" WHERE "status" = 'Delivered' AND "received_at" IS NULL;
