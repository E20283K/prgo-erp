CREATE TABLE "product_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_types" ADD CONSTRAINT "product_types_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_types_company_name_uq" ON "product_types" USING btree ("company_id","name");--> statement-breakpoint
-- Boshlang'ich turlar har bir korxona uchun.
INSERT INTO "product_types" ("company_id", "name")
SELECT c."id", t."name"
FROM "companies" c
CROSS JOIN (VALUES
  ('Karton etiketka'), ('Neylon etiketka'), ('Satin etiketka'), ('Paxta etiketka'),
  ('Jakard etiketka'), ('Taffeta etiketka'), ('Termo etiketka'), ('Stiker'),
  ('Hangtag'), ('Karton quti'), ('Paket'), ('Lenta')
) AS t("name")
ON CONFLICT ("company_id", "name") DO NOTHING;
