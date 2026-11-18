CREATE TABLE "finishing_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"value" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finishing_options" ADD CONSTRAINT "finishing_options_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finishing_options_company_kind_value_uq" ON "finishing_options" USING btree ("company_id","kind","value");--> statement-breakpoint
-- Boshlang'ich turlar har bir korxona uchun (avval kodda qattiq yozilgan ro'yxat).
INSERT INTO "finishing_options" ("company_id", "kind", "value", "label", "sort_order")
SELECT c."id", t."kind", t."value", t."label", t."sort_order"
FROM "companies" c
CROSS JOIN (VALUES
  ('lamination', 'Soft-Touch Matte', 'Soft-Touch Matte', 1),
  ('lamination', 'Matte Lamination', 'Matte Lamination', 2),
  ('lamination', 'Gloss Lamination', 'Gloss Lamination', 3),
  ('lamination', 'Anti-Scuff Matte', 'Anti-Scuff Matte', 4),
  ('lamination', 'Thermal Metallized Silver', 'Metallized Silver', 5),
  ('lamination', 'Thermal Metallized Gold', 'Metallized Gold', 6),
  ('lamination', 'Holographic Film', 'Holographic Film', 7),
  ('coating', 'Spot UV (3D)', 'Tanlanma 3D UF lak', 1),
  ('coating', 'Spot UV (Flat)', 'Tanlanma tekis UF lak', 2),
  ('coating', 'Overall UV', 'Umumiy UF lak', 3),
  ('coating', 'Overall WB Varnish', 'Suvli dispersion lak', 4),
  ('coating', 'Drip-off Varnish', 'Drip-off gibrid lak', 5),
  ('embellishment', 'Screen White', 'Oq rang (Ipak bosma / Serigrafiya)', 1),
  ('embellishment', 'Gold Hot Foil', 'Oltin issiq folga', 2),
  ('embellishment', 'Silver Hot Foil', 'Kumush issiq folga', 3),
  ('embellishment', 'Holographic Foil', 'Golografik folga', 4),
  ('embellishment', 'Blind Emboss', 'Relyefli bo''rtma (Kongrev)', 5),
  ('embellishment', 'Deboss', 'Botiq bosma (Blint)', 6)
) AS t("kind", "value", "label", "sort_order")
ON CONFLICT ("company_id", "kind", "value") DO NOTHING;
