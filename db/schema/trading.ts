import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./core";
import { clients } from "./crm";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const yttLegalTypeEnum = pgEnum("trading_ytt_legal_type", [
  "YTT",
  "MChJ",
]);

export const yttTurnoverStatusEnum = pgEnum("trading_ytt_status", [
  "Safe",
  "Warning",
  "Critical",
  "Unlimited",
]);

export const tradingDocStatusEnum = pgEnum("trading_doc_status", [
  "Draft",
  "Posted",
  "Cancelled",
]);

export const tradingPaymentMethodEnum = pgEnum("trading_payment_method", [
  "bank_wire",
  "corporate_card",
  "cash",
]);

export const importBatchStatusEnum = pgEnum("trading_import_status", [
  "in_transit",
  "customs_clearance",
  "arrived_calculated",
  "allocated_to_stock",
]);

export const tradingProductCategoryEnum = pgEnum("trading_product_category", [
  "Tugmalar",
  "Fermuarlar",
  "Jakkard",
  "Iplar",
  "Yorliqlar",
  "Furnitura",
]);

// ─── 1. Trading YTT & Legal Entities (YTT Aylanma Limit Registri) ──────────────

export const tradingYttEntities = pgTable(
  "trading_ytt_entities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // ytt-qodirov
    name: varchar("name", { length: 255 }).notNull(),
    legalType: yttLegalTypeEnum("legal_type").default("YTT").notNull(),
    inn: varchar("inn", { length: 32 }).notNull(),
    bankName: varchar("bank_name", { length: 255 }),
    bankAccount: varchar("bank_account", { length: 64 }),
    annualLimitUzs: numeric("annual_limit_uzs", { precision: 18, scale: 2 }).default("1000000000.00").notNull(),
    currentTurnoverUzs: numeric("current_turnover_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    status: yttTurnoverStatusEnum("status").default("Safe").notNull(),
    isRecommended: boolean("is_recommended").default(false).notNull(),
    activeContractsCount: integer("active_contracts_count").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trading_ytt_company_code_uq").on(table.companyId, table.code),
    index("trading_ytt_company_idx").on(table.companyId),
    index("trading_ytt_inn_idx").on(table.inn),
  ]
);

// ─── 2. Trading Sales (Sotuv Hujjatlari) ───────────────────────────────────────

export const tradingSales = pgTable(
  "trading_sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    docNo: varchar("doc_no", { length: 64 }).notNull(), // TR-SALE-2026-001
    date: varchar("date", { length: 32 }).notNull(),
    sellerEntityId: uuid("seller_entity_id").references(() => tradingYttEntities.id, {
      onDelete: "restrict",
    }),
    sellerEntityName: varchar("seller_entity_name", { length: 255 }),
    sellerEntityInn: varchar("seller_entity_inn", { length: 32 }),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    customer: varchar("customer", { length: 255 }).notNull(),
    customerTin: varchar("customer_tin", { length: 32 }),
    contractNo: varchar("contract_no", { length: 64 }),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 2 }).default("12850.00").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalUsd: numeric("total_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    totalUzs: numeric("total_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    paymentMethod: tradingPaymentMethodEnum("payment_method").default("bank_wire").notNull(),
    status: tradingDocStatusEnum("status").default("Draft").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trading_sales_company_doc_uq").on(table.companyId, table.docNo),
    index("trading_sales_company_idx").on(table.companyId),
    index("trading_sales_seller_idx").on(table.sellerEntityId),
    index("trading_sales_client_idx").on(table.clientId),
  ]
);

// ─── 3. Trading Sale Items (Savdo Qatorlari) ───────────────────────────────────

export const tradingSaleItems = pgTable(
  "trading_sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => tradingSales.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    category: tradingProductCategoryEnum("category").default("Tugmalar").notNull(),
    unit: varchar("unit", { length: 32 }).default("dona").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 18, scale: 2 }).default("0.00").notNull(),
    unitPriceUzs: numeric("unit_price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    unitPriceUsd: numeric("unit_price_usd", { precision: 14, scale: 4 }).default("0.0000").notNull(),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalUsd: numeric("total_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    isSelfProduced: boolean("is_self_produced").default(false).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("trading_sale_items_sale_idx").on(table.saleId),
  ]
);

// ─── 4. Trading Import Batches (Xitoy / Xorij Import Partiyalari) ──────────────

export const tradingImportBatches = pgTable(
  "trading_import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    batchNo: varchar("batch_no", { length: 64 }).notNull(), // IMP-2026-OCT-01
    date: varchar("date", { length: 32 }).notNull(),
    origin: varchar("origin", { length: 128 }), // Guangzhou, Yiwu, etc.
    supplier: varchar("supplier", { length: 255 }).notNull(),
    containerNo: varchar("container_no", { length: 64 }),
    fobAmountUsd: numeric("fob_amount_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    internationalCargoUsd: numeric("international_cargo_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    grossWeightKg: numeric("gross_weight_kg", { precision: 12, scale: 2 }).default("0.00").notNull(),
    customsDutyUzs: numeric("customs_duty_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 2 }).default("12850.00").notNull(),
    totalLandedCostUzs: numeric("total_landed_cost_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    landedCostMarkupPercent: numeric("landed_cost_markup_percent", { precision: 5, scale: 2 }).default("0.00").notNull(),
    status: importBatchStatusEnum("status").default("in_transit").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trading_import_company_batch_uq").on(table.companyId, table.batchNo),
    index("trading_import_company_idx").on(table.companyId),
    index("trading_import_status_idx").on(table.status),
  ]
);

// ─── 5. Trading Import Items (Import Partiya Qatorlari) ────────────────────────

export const tradingImportItems = pgTable(
  "trading_import_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => tradingImportBatches.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 128 }),
    unit: varchar("unit", { length: 32 }).default("dona").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    fobPriceUsd: numeric("fob_price_usd", { precision: 14, scale: 4 }).default("0.0000").notNull(),
    fobTotalUsd: numeric("fob_total_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    landedCostUzs: numeric("landed_cost_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    suggestedSalePriceUzs: numeric("suggested_sale_price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("trading_import_items_batch_idx").on(table.batchId),
  ]
);

// ─── 6. Trading Catalog (Tekstil Furnitura va Mahsulotlar Katalogi) ────────────

export const tradingCatalog = pgTable(
  "trading_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: tradingProductCategoryEnum("category").default("Tugmalar").notNull(),
    unit: varchar("unit", { length: 32 }).default("dona").notNull(),
    priceUzs: numeric("price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    priceUsd: numeric("price_usd", { precision: 14, scale: 4 }).default("0.0000").notNull(),
    wholesalePriceUzs: numeric("wholesale_price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    retailPriceUzs: numeric("retail_price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    stockQty: numeric("stock_qty", { precision: 14, scale: 3 }).default("0.000").notNull(),
    minStockLevel: numeric("min_stock_level", { precision: 14, scale: 3 }).default("0.000").notNull(),
    origin: varchar("origin", { length: 128 }),
    material: varchar("material", { length: 128 }),
    colorCode: varchar("color_code", { length: 64 }),
    dimensions: varchar("dimensions", { length: 128 }),
    supplier: varchar("supplier", { length: 255 }),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("trading_catalog_company_sku_uq").on(table.companyId, table.sku),
    index("trading_catalog_company_idx").on(table.companyId),
    index("trading_catalog_category_idx").on(table.category),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const tradingYttEntitiesRelations = relations(tradingYttEntities, ({ one, many }) => ({
  company: one(companies, {
    fields: [tradingYttEntities.companyId],
    references: [companies.id],
  }),
  sales: many(tradingSales),
}));

export const tradingSalesRelations = relations(tradingSales, ({ one, many }) => ({
  company: one(companies, {
    fields: [tradingSales.companyId],
    references: [companies.id],
  }),
  sellerEntity: one(tradingYttEntities, {
    fields: [tradingSales.sellerEntityId],
    references: [tradingYttEntities.id],
  }),
  client: one(clients, {
    fields: [tradingSales.clientId],
    references: [clients.id],
  }),
  items: many(tradingSaleItems),
}));

export const tradingSaleItemsRelations = relations(tradingSaleItems, ({ one }) => ({
  sale: one(tradingSales, {
    fields: [tradingSaleItems.saleId],
    references: [tradingSales.id],
  }),
}));

export const tradingImportBatchesRelations = relations(tradingImportBatches, ({ one, many }) => ({
  company: one(companies, {
    fields: [tradingImportBatches.companyId],
    references: [companies.id],
  }),
  items: many(tradingImportItems),
}));

export const tradingImportItemsRelations = relations(tradingImportItems, ({ one }) => ({
  batch: one(tradingImportBatches, {
    fields: [tradingImportItems.batchId],
    references: [tradingImportBatches.id],
  }),
}));

export const tradingCatalogRelations = relations(tradingCatalog, ({ one }) => ({
  company: one(companies, {
    fields: [tradingCatalog.companyId],
    references: [companies.id],
  }),
}));
