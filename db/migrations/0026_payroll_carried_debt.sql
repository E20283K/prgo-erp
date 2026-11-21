ALTER TABLE "payroll_records" ADD COLUMN "carried_debt_in" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "carried_debt_out" numeric(15, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "worked_days" integer;--> statement-breakpoint
ALTER TABLE "payroll_records" ADD COLUMN "working_days" integer;