ALTER TABLE "warehouse_shipments" ADD COLUMN "recipient_name" varchar(255);--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "recipient_phone" varchar(64);--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "delivery_address" text;