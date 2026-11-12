ALTER TYPE "public"."warehouse_shipment_status" ADD VALUE 'Reserved' BEFORE 'Packed';--> statement-breakpoint
ALTER TYPE "public"."warehouse_shipment_status" ADD VALUE 'Picking' BEFORE 'Packed';--> statement-breakpoint
ALTER TYPE "public"."finance_delivery_act_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "reserved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "warehouse_shipments" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trading_catalog" ADD COLUMN "reserved_qty" numeric(14, 3) DEFAULT '0.000' NOT NULL;