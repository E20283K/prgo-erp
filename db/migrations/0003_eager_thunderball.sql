ALTER TABLE "telegram_chats" ALTER COLUMN "settings" SET DEFAULT '{"notifyOrderCreated":true,"notifyProofReady":true,"notifyProductionDone":true,"notifyPaymentReminder":false,"notifyPoCreated":true,"notifyPoReady":true}'::jsonb;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "telegram_chat_id" varchar(64);--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "telegram_message_id" integer;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "telegram_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_orders" ADD COLUMN "telegram_confirmed_by" varchar(128);--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD COLUMN "chat_category" varchar(32) DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "telegram_chats" ADD CONSTRAINT "telegram_chats_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telegram_chats_supplier_idx" ON "telegram_chats" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "telegram_chats_category_idx" ON "telegram_chats" USING btree ("chat_category");