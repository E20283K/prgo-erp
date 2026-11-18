ALTER TABLE "warehouse_stock_balances" ALTER COLUMN "unit_price_usd" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ALTER COLUMN "unit_price_usd" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "unit_price_uzs" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "currency" varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "supplier" varchar(255);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "batch_no" varchar(64);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "grain_direction" varchar(16);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "roll_width_mm" numeric(10, 1);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "roll_length_m" numeric(12, 1);--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "expiry_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "warehouse_stock_balances" ADD COLUMN "paper_spec" jsonb;