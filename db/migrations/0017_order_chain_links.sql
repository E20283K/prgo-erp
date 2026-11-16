ALTER TABLE "piecework_logs" ADD COLUMN "source_event_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "work_order_events" ADD CONSTRAINT "work_order_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "piecework_source_event_uq" ON "piecework_logs" USING btree ("source_event_id");