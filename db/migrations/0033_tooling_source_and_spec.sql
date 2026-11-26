ALTER TABLE "dies_tooling" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD COLUMN "file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD COLUMN "source_order_id" uuid;--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD COLUMN "source_order_no" varchar(64);--> statement-breakpoint
ALTER TABLE "dies_tooling" ADD COLUMN "work_order_no" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "tooling_spec" jsonb;--> statement-breakpoint
CREATE INDEX "dies_tooling_source_order_idx" ON "dies_tooling" USING btree ("source_order_id");