ALTER TABLE "work_order_events" ADD COLUMN "client_event_id" varchar(64);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "occurred_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "shift" varchar(16);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "batch_label" varchar(128);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "make_ready_qty" integer;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "defect_qty" integer;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "output_pieces_qty" integer;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "downtime_reason" varchar(128);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "downtime_minutes" integer;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "pallet_code" varchar(64);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "pallet_number" integer;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "status" varchar(16);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "created_by" varchar(128);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "updated_by" varchar(128);--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "deleted_by" varchar(128);--> statement-breakpoint
CREATE UNIQUE INDEX "work_order_events_client_uq" ON "work_order_events" USING btree ("work_order_id","client_event_id");--> statement-breakpoint
-- Older rows: the moment they were written is the best known time; their own id becomes the client id.
UPDATE "work_order_events" SET "occurred_at" = "created_at" WHERE "occurred_at" IS NULL;--> statement-breakpoint
UPDATE "work_order_events" SET "client_event_id" = "id"::text WHERE "client_event_id" IS NULL;
