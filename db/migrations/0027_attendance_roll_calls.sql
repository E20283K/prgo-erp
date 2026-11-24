CREATE TABLE "attendance_roll_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"work_date" date NOT NULL,
	"shift_type" varchar(16) NOT NULL,
	"chat_id" varchar(64),
	"reminder_message_id" integer,
	"reminder_sent_at" timestamp with time zone,
	"summary_message_id" integer,
	"completed_at" timestamp with time zone,
	"completed_by" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_roll_calls" ADD CONSTRAINT "attendance_roll_calls_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_roll_calls_uq" ON "attendance_roll_calls" USING btree ("company_id","work_date","shift_type");