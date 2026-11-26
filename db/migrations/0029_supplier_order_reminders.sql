ALTER TABLE "supplier_orders" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "reminder_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "last_reminder_at" timestamp with time zone;