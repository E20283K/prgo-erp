CREATE TABLE "work_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"department" varchar(64),
	"unit" varchar(64) DEFAULT '1,000 sheets' NOT NULL,
	"unit_divisor" integer DEFAULT 1000 NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"piece_rate" numeric(14, 4) DEFAULT '0' NOT NULL,
	"helper_piece_rate" numeric(14, 4) DEFAULT '0' NOT NULL,
	"status" varchar(16) DEFAULT 'Active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "work_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "downtime_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD COLUMN "actual_duration_minutes" integer;--> statement-breakpoint
ALTER TABLE "work_rates" ADD CONSTRAINT "work_rates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_rates_company_code_uq" ON "work_rates" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "work_rates_company_idx" ON "work_rates" USING btree ("company_id");--> statement-breakpoint
ALTER TABLE "work_order_operations" ADD CONSTRAINT "work_order_operations_work_rate_id_work_rates_id_fk" FOREIGN KEY ("work_rate_id") REFERENCES "public"."work_rates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Sdelka stavkalari tariflardan (sotuv narxi spravochnigi) alohida "Ish turlari" spravochnigiga ko'chiriladi.
INSERT INTO "work_rates" ("company_id", "code", "name", "department", "unit", "unit_divisor", "currency", "piece_rate", "helper_piece_rate", "notes")
SELECT t."company_id",
       'IT-' || lpad((row_number() OVER (PARTITION BY t."company_id" ORDER BY t."code"))::text, 3, '0'),
       t."operation_name",
       t."department",
       t."unit",
       t."unit_divisor",
       t."currency",
       t."piecework_rate_usd",
       t."helper_piecework_rate_usd",
       'Tarif ' || t."code" || ' dan ko''chirildi'
FROM "tariffs" t
WHERE t."piecework_rate_usd" > 0 OR t."helper_piecework_rate_usd" > 0;
