import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./core";

// ─── Enums: Nomenklatura Turlari (1C Uslubida) ─────────────────────────────────

export const itemTypeEnum = pgEnum("item_type", [
  "raw_material",  // Xomashyo (satin, qog'oz, bo'yoq, plyonka, ximiya)
  "semi_finished", // Yarim tayyor mahsulot (kesilgan rulon, pechat qilingan lenta)
  "finished_good", // Tayyor mahsulot (tayyor yorliq, shtrix-kod, korobka)
  "service",       // Xizmat (laminatsiya, shtamp urish, dizayn)
  "consumable",    // Sarflovchi material (skotch, pichoq lezviyasi, vtulka)
]);

// ─── 1. Units of Measure (O'lchov Birliklari Klassifikatori) ───────────────────

export const unitsOfMeasure = pgTable(
  "units_of_measure",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 16 }).notNull(), // masalan: "pcs", "m", "sqm", "kg", "roll"
    name: varchar("name", { length: 64 }).notNull(), // masalan: "Dona (Штука)", "Pogonomentr (Погонный метр)"
    shortName: varchar("short_name", { length: 16 }).notNull(), // masalan: "dona", "m", "m²", "kg", "rulon"
    internationalCode: varchar("international_code", { length: 16 }), // masalan: "PCE", "MTR", "MTK", "KGM"
    precision: integer("precision").default(0).notNull(), // Verguldan keyingi belgilar soni (dona uchun 0, kg uchun 3)
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("units_code_uq").on(table.code),
    index("units_is_active_idx").on(table.isActive),
  ]
);

// ─── 2. Items & Raw Materials (Nomenklatura & Materiallar) ──────────────────────

export interface ItemProperties {
  // Xomashyo xususiyatlari (rulon, lenta, qog'oz)
  webWidth?: number;            // Standart lenta eni (mm)
  standardWidths?: number[];    // Mavjud enlar massivi (mm)
  densityGsm?: number;          // Zichlik (g/m²)
  thicknessMicrons?: number;    // Qalinlik (mikron)
  color?: string;               // Asos rangi (masalan: "#ffffff", "White", "Black")
  adhesiveType?: string;        // Yelim turi (masalan: "Permanent Acrylic", "Hotmelt", "Removable")
  linerType?: string;           // Podlozhka (masalan: "Glassine White 62g", "Kraft")
  surfaceFinish?: string;       // Yuzasi (masalan: "Gloss", "Semi-Gloss", "Matte", "Woven Satin")
  manufacturer?: string;        // Ishlab chiqaruvchi brend (masalan: "Avery Dennison", "UPM Raflatac")
  shelfLifeMonths?: number;     // Yaroqlilik muddati (oy)
  [key: string]: unknown;
}

export const items = pgTable(
  "items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // SKU / Nomenklatura artikuli
    name: varchar("name", { length: 255 }).notNull(),
    itemType: itemTypeEnum("item_type").default("raw_material").notNull(),
    category: varchar("category", { length: 64 }).notNull(), // "Satin", "Nylon", "Paper", "Self-Adhesive", "Ink", va h.k.
    unitId: uuid("unit_id")
      .notNull()
      .references(() => unitsOfMeasure.id, { onDelete: "restrict" }),
    description: text("description"),
    minStock: numeric("min_stock", { precision: 12, scale: 3 }).default("0").notNull(),
    standardCost: numeric("standard_cost", { precision: 15, scale: 2 }).default("0").notNull(),
    sellingPrice: numeric("selling_price", { precision: 15, scale: 2 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    properties: jsonb("properties").$type<ItemProperties>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("items_company_code_uq").on(table.companyId, table.code),
    index("items_company_category_idx").on(table.companyId, table.category),
    index("items_company_item_type_idx").on(table.companyId, table.itemType),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const unitsOfMeasureRelations = relations(unitsOfMeasure, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one }) => ({
  company: one(companies, {
    fields: [items.companyId],
    references: [companies.id],
  }),
  unit: one(unitsOfMeasure, {
    fields: [items.unitId],
    references: [unitsOfMeasure.id],
  }),
}));

export type UnitOfMeasure = typeof unitsOfMeasure.$inferSelect;
export type NewUnitOfMeasure = typeof unitsOfMeasure.$inferInsert;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
