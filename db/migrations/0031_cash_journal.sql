CREATE TYPE "public"."finance_cash_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."finance_money_account_kind" AS ENUM('bank', 'cash', 'card');--> statement-breakpoint
CREATE TYPE "public"."finance_pnl_type" AS ENUM('revenue', 'cogs', 'expense', 'capex', 'prepayment', 'settlement', 'transfer');--> statement-breakpoint
ALTER TYPE "public"."supplier_order_type" ADD VALUE 'equipment';--> statement-breakpoint
CREATE TABLE "cash_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" varchar(128) NOT NULL,
	"group" varchar(32) DEFAULT 'other' NOT NULL,
	"direction" "finance_cash_direction" DEFAULT 'out' NOT NULL,
	"pnl_type" "finance_pnl_type" DEFAULT 'expense' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"date" date NOT NULL,
	"direction" "finance_cash_direction" NOT NULL,
	"account_id" uuid,
	"category_id" uuid NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" varchar(8) DEFAULT 'UZS' NOT NULL,
	"exchange_rate" numeric(12, 2),
	"amount_uzs" numeric(18, 2) NOT NULL,
	"method" "finance_payment_method" DEFAULT 'cash' NOT NULL,
	"counterparty_type" varchar(16) DEFAULT 'other' NOT NULL,
	"employee_id" uuid,
	"supplier_id" uuid,
	"client_id" uuid,
	"counterparty_name" varchar(255),
	"work_order_id" uuid,
	"source_type" varchar(32) DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"source_doc_no" varchar(64),
	"status" varchar(16) DEFAULT 'posted' NOT NULL,
	"reversal_of_id" uuid,
	"note" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "bank_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "account_no" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ALTER COLUMN "mfo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD COLUMN "supplier_order_id" uuid;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "kind" "finance_money_account_kind" DEFAULT 'bank' NOT NULL;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "opening_balance" numeric(18, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_categories" ADD CONSTRAINT "cash_categories_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_account_id_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_category_id_cash_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."cash_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_reversal_of_id_cash_transactions_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."cash_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cash_categories_company_code_uq" ON "cash_categories" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "cash_categories_company_idx" ON "cash_categories" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_tx_source_uq" ON "cash_transactions" USING btree ("company_id","source_type","source_id") WHERE "cash_transactions"."source_id" IS NOT NULL AND "cash_transactions"."reversal_of_id" IS NULL AND "cash_transactions"."status" = 'posted';--> statement-breakpoint
CREATE INDEX "cash_tx_company_date_idx" ON "cash_transactions" USING btree ("company_id","date");--> statement-breakpoint
CREATE INDEX "cash_tx_account_idx" ON "cash_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "cash_tx_category_idx" ON "cash_transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "cash_tx_employee_idx" ON "cash_transactions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "cash_tx_supplier_idx" ON "cash_transactions" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "cash_tx_work_order_idx" ON "cash_transactions" USING btree ("work_order_id");--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_receipts" ADD CONSTRAINT "warehouse_receipts_supplier_order_id_supplier_orders_id_fk" FOREIGN KEY ("supplier_order_id") REFERENCES "public"."supplier_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipts_supplier_idx" ON "warehouse_receipts" USING btree ("supplier_id");