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
import { clients, suppliers, supplierOrders } from "./crm";
import { workOrders } from "./production";
import { warehouseShipments } from "./warehouse";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const paymentMethodEnum = pgEnum("finance_payment_method", [
  "bank_transfer",
  "cash",
  "corporate_card",
  "offset",
]);

export const paymentStatusEnum = pgEnum("finance_payment_status", [
  "pending",
  "confirmed",
  "cancelled",
]);

export const deliveryActStatusEnum = pgEnum("finance_delivery_act_status", [
  "draft",
  "pending_signature",
  "signed",
  "disputed",
]);

export const settlementStatusEnum = pgEnum("finance_settlement_status", [
  "debt",
  "settled",
  "advance",
]);

// ─── 1. Bank Accounts (Korxona Bank Hisoblari) ─────────────────────────────────

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 128 }).notNull(), // Masalan: "Kapitalbank Asosiy UZS"
    bankName: varchar("bank_name", { length: 255 }).notNull(),
    accountNo: varchar("account_no", { length: 64 }).notNull(), // 20208000...
    mfo: varchar("mfo", { length: 16 }).notNull(), // 00440...
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    balance: numeric("balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("bank_accounts_company_idx").on(table.companyId),
    index("bank_accounts_acc_idx").on(table.accountNo),
  ]
);

// ─── 2. Delivery Acts (Yetkazib berish dalolatlari / Fakturalar) ────────────────

export const deliveryActs = pgTable(
  "delivery_acts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    docNo: varchar("doc_no", { length: 64 }).notNull(), // ACT-2026-0001
    date: varchar("date", { length: 32 }).notNull(), // YYYY-MM-DD
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    clientName: varchar("client_name", { length: 255 }),
    clientTin: varchar("client_tin", { length: 32 }),
    contractNo: varchar("contract_no", { length: 64 }),
    workOrderId: uuid("work_order_id").references(() => workOrders.id, {
      onDelete: "set null",
    }),
    carrier: varchar("carrier", { length: 128 }),
    driverName: varchar("driver_name", { length: 128 }),
    driverPhone: varchar("driver_phone", { length: 64 }),
    vehicleNo: varchar("vehicle_no", { length: 32 }),
    recipientName: varchar("recipient_name", { length: 128 }),
    powerOfAttorney: varchar("power_of_attorney", { length: 64 }),
    subtotalUsd: numeric("subtotal_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    subtotalUzs: numeric("subtotal_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 2 }).default("12850.00").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("12.00").notNull(),
    vatAmountUsd: numeric("vat_amount_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    vatAmountUzs: numeric("vat_amount_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalAmountUsd: numeric("total_amount_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    totalAmountUzs: numeric("total_amount_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    warehouse: varchar("warehouse", { length: 128 }),
    linkedShipmentId: uuid("linked_shipment_id").references(() => warehouseShipments.id, {
      onDelete: "set null",
    }),
    status: deliveryActStatusEnum("status").default("draft").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("delivery_acts_company_doc_uq").on(table.companyId, table.docNo),
    index("delivery_acts_company_idx").on(table.companyId),
    index("delivery_acts_client_idx").on(table.clientId),
    index("delivery_acts_status_idx").on(table.status),
    index("delivery_acts_date_idx").on(table.date),
  ]
);

// ─── 3. Delivery Act Items (Akt Qatorlari) ─────────────────────────────────────

export const deliveryActItems = pgTable(
  "delivery_act_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actId: uuid("act_id")
      .notNull()
      .references(() => deliveryActs.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }),
    name: varchar("name", { length: 255 }).notNull(),
    size: varchar("size", { length: 128 }),
    unit: varchar("unit", { length: 32 }).default("dona").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 3 }).notNull(),
    unitPriceUsd: numeric("unit_price_usd", { precision: 14, scale: 4 }).default("0.0000").notNull(),
    unitPriceUzs: numeric("unit_price_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalUsd: numeric("total_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    totalUzs: numeric("total_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).default("12.00").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
  },
  (table) => [
    index("delivery_act_items_act_idx").on(table.actId),
  ]
);

// ─── 4. Client Settlements (Mijozlar hisob-kitob saldosi) ─────────────────────

export const clientSettlements = pgTable(
  "client_settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    customer: varchar("customer", { length: 255 }).notNull(),
    customerTin: varchar("customer_tin", { length: 32 }),
    contractNo: varchar("contract_no", { length: 64 }),
    openingBalanceUsd: numeric("opening_balance_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    openingBalanceUzs: numeric("opening_balance_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalDebitUsd: numeric("total_debit_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    totalDebitUzs: numeric("total_debit_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    totalCreditUsd: numeric("total_credit_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    totalCreditUzs: numeric("total_credit_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    closingBalanceUsd: numeric("closing_balance_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    closingBalanceUzs: numeric("closing_balance_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    lastActivityDate: varchar("last_activity_date", { length: 32 }),
    status: settlementStatusEnum("status").default("settled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("client_settlements_client_contract_uq").on(table.clientId, table.contractNo),
    index("client_settlements_company_idx").on(table.companyId),
    index("client_settlements_client_idx").on(table.clientId),
    index("client_settlements_status_idx").on(table.status),
  ]
);

// ─── 5. Client Payments (Mijoz to'lovlari) ─────────────────────────────────────

export const clientPayments = pgTable(
  "client_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    docNo: varchar("doc_no", { length: 64 }).notNull(), // PAY-2026-0001
    date: varchar("date", { length: 32 }).notNull(), // YYYY-MM-DD
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    settlementId: uuid("settlement_id").references(() => clientSettlements.id, {
      onDelete: "set null",
    }),
    customer: varchar("customer", { length: 255 }).notNull(),
    contractNo: varchar("contract_no", { length: 64 }),
    amountUsd: numeric("amount_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    amountUzs: numeric("amount_uzs", { precision: 18, scale: 2 }).default("0.00").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 2 }).default("12850.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    method: paymentMethodEnum("method").default("bank_transfer").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    deliveryActId: uuid("delivery_act_id").references(() => deliveryActs.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    status: paymentStatusEnum("status").default("confirmed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("client_payments_company_doc_uq").on(table.companyId, table.docNo),
    index("client_payments_company_idx").on(table.companyId),
    index("client_payments_client_idx").on(table.clientId),
    index("client_payments_date_idx").on(table.date),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  company: one(companies, {
    fields: [bankAccounts.companyId],
    references: [companies.id],
  }),
}));

export const deliveryActsRelations = relations(deliveryActs, ({ one, many }) => ({
  company: one(companies, {
    fields: [deliveryActs.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [deliveryActs.clientId],
    references: [clients.id],
  }),
  workOrder: one(workOrders, {
    fields: [deliveryActs.workOrderId],
    references: [workOrders.id],
  }),
  linkedShipment: one(warehouseShipments, {
    fields: [deliveryActs.linkedShipmentId],
    references: [warehouseShipments.id],
  }),
  items: many(deliveryActItems),
  payments: many(clientPayments),
}));

export const deliveryActItemsRelations = relations(deliveryActItems, ({ one }) => ({
  act: one(deliveryActs, {
    fields: [deliveryActItems.actId],
    references: [deliveryActs.id],
  }),
}));

export const clientSettlementsRelations = relations(clientSettlements, ({ one, many }) => ({
  company: one(companies, {
    fields: [clientSettlements.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [clientSettlements.clientId],
    references: [clients.id],
  }),
  payments: many(clientPayments),
}));

export const clientPaymentsRelations = relations(clientPayments, ({ one }) => ({
  company: one(companies, {
    fields: [clientPayments.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [clientPayments.clientId],
    references: [clients.id],
  }),
  settlement: one(clientSettlements, {
    fields: [clientPayments.settlementId],
    references: [clientSettlements.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [clientPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
  deliveryAct: one(deliveryActs, {
    fields: [clientPayments.deliveryActId],
    references: [deliveryActs.id],
  }),
}));

// ─── 6. Supplier Payments (Ta'minotchilarga chiqim to'lovlari) ──────────────────

export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    docNo: varchar("doc_no", { length: 64 }).notNull(), // SPAY-2026-0001
    date: varchar("date", { length: 32 }).notNull(), // YYYY-MM-DD
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    supplierName: varchar("supplier_name", { length: 255 }).notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    method: paymentMethodEnum("method").default("bank_transfer").notNull(),
    bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, {
      onDelete: "set null",
    }),
    supplierOrderId: uuid("supplier_order_id").references(() => supplierOrders.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    status: paymentStatusEnum("status").default("confirmed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supplier_payments_company_doc_uq").on(table.companyId, table.docNo),
    index("supplier_payments_company_idx").on(table.companyId),
    index("supplier_payments_supplier_idx").on(table.supplierId),
    index("supplier_payments_date_idx").on(table.date),
  ]
);

export const supplierPaymentsRelations = relations(supplierPayments, ({ one }) => ({
  company: one(companies, {
    fields: [supplierPayments.companyId],
    references: [companies.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierPayments.supplierId],
    references: [suppliers.id],
  }),
  bankAccount: one(bankAccounts, {
    fields: [supplierPayments.bankAccountId],
    references: [bankAccounts.id],
  }),
  supplierOrder: one(supplierOrders, {
    fields: [supplierPayments.supplierOrderId],
    references: [supplierOrders.id],
  }),
}));
