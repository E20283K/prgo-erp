ALTER TABLE "supplier_orders" ADD COLUMN "tooling_item_id" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "remake_reason" text;--> statement-breakpoint
CREATE INDEX "supplier_orders_tooling_item_idx" ON "supplier_orders" USING btree ("company_id","work_order_no","tooling_item_id");