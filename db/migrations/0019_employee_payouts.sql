CREATE TABLE "telegram_payout_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"tg_chat_id" varchar(64) NOT NULL,
	"source_message_id" integer NOT NULL,
	"bot_message_id" integer,
	"transcript" text,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "kind" varchar(16) DEFAULT 'advance' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "currency" varchar(3) DEFAULT 'UZS' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "payment_method" varchar(16) DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "source" varchar(16) DEFAULT 'ui' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "telegram_chat_id" varchar(64);--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "telegram_message_id" integer;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "cancelled_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_advances" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_user_id" varchar(32);--> statement-breakpoint
ALTER TABLE "telegram_payout_drafts" ADD CONSTRAINT "telegram_payout_drafts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tg_payout_drafts_source_uq" ON "telegram_payout_drafts" USING btree ("tg_chat_id","source_message_id");--> statement-breakpoint
CREATE INDEX "tg_payout_drafts_company_idx" ON "telegram_payout_drafts" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "advances_company_period_kind_idx" ON "employee_advances" USING btree ("company_id","period","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_user_uq" ON "users" USING btree ("telegram_user_id");