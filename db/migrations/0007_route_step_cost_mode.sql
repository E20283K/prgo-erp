ALTER TABLE "work_order_operations" ADD COLUMN "machine_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "cost_mode" varchar(16) DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "manual_cost_usd" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "cost_note" text;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_machine_id_production_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."production_machines"("id") ON DELETE set null ON UPDATE no action;