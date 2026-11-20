ALTER TABLE "supplier_orders" ADD COLUMN "delivery_method" varchar(16);--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "delivery_cost" numeric(18, 2) DEFAULT '0.00' NOT NULL;