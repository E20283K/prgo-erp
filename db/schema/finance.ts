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
  date,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { companies } from "./core";
import { employees } from "./hr";
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
  "cancelled", // Ombor chiqimi stornosi natijasida bekor qilingan
]);

export const settlementStatusEnum = pgEnum("finance_settlement_status", [
  "debt",
  "settled",
  "advance",
]);

/** Where the money sits: a bank account, a cash desk (kassa) or a corporate card. */
export const moneyAccountKindEnum = pgEnum("finance_money_account_kind", [
  "bank",
  "cash",
  "card",
]);

/**
 * How a cash-journal category lands in the reports. Paying money and recognising a cost
 * are separate events, so a payment of an existing debt is a "settlement", not an expense.
 */
export const pnlTypeEnum = pgEnum("finance_pnl_type", [
  "revenue",    // Daromad (P&L)
  "cogs",       // Tannarx: xomashyo sarfi, dostavka, autsorsing
  "expense",    // Davr xarajati: ijara, kommunal, ish haqi fondi
  "capex",      // Asosiy vosita: jihoz (P&L ga birdaniga tushmaydi)
  "prepayment", // Avans: xarajat emas, debitorlik
  "settlement", // Qarzni yopish: ta'minotchiga to'lov, mijoz to'lovi, oylik raschet
  "transfer",   // Hisoblar orasida o'tkazma
]);

export const cashDirectionEnum = pgEnum("finance_cash_direction", ["in", "out"]);

// ─── 1. Money Accounts (Bank hisoblari, kassa, karta) ──────────────────────────

export const bankAccounts = pgTable(
  "bank_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    kind: moneyAccountKindEnum("kind").default("bank").notNull(),
    name: varchar("name", { length: 128 }).notNull(), // Masalan: "Kapitalbank Asosiy UZS" | "Asosiy kassa"
    // Bank rekvizitlari faqat kind = "bank" uchun majburiy (kassa va kartada bo'sh).
    bankName: varchar("bank_name", { length: 255 }),
    accountNo: varchar("account_no", { length: 64 }), // 20208000...
    mfo: varchar("mfo", { length: 16 }), // 00440...
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    // Qoldiq = boshlang'ich qoldiq + pul harakati jurnali. `balance` shu yig'indining keshi.
    openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
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

// ─── 7. Expense Categories (Pul harakati moddalari) ───────────────────────────

export const cashCategories = pgTable(
  "cash_categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(), // PAYROLL_ADVANCE, RENT, ...
    name: varchar("name", { length: 128 }).notNull(),
    // payroll | materials | logistics | equipment | tooling | outsourcing | overhead | tax | finance | sales | other
    group: varchar("group", { length: 32 }).default("other").notNull(),
    direction: cashDirectionEnum("direction").default("out").notNull(),
    pnlType: pnlTypeEnum("pnl_type").default("expense").notNull(),
    // System categories are written by integrations (avans, raschet, to'lovlar): not deletable or re-typed.
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cash_categories_company_code_uq").on(table.companyId, table.code),
    index("cash_categories_company_idx").on(table.companyId),
  ]
);

// ─── 8. Cash Journal (Pul harakati jurnali) ───────────────────────────────────
// One row per movement of money in or out of a money account. Source modules post here in the
// same transaction as their own document; a cancellation posts a reversal row, never a delete.

export const cashTransactions = pgTable(
  "cash_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    date: date("date").notNull(),
    direction: cashDirectionEnum("direction").notNull(),
    // Null only for legacy rows whose account was never recorded.
    accountId: uuid("account_id").references(() => bankAccounts.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => cashCategories.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 18, scale: 2 }).notNull(), // Always positive; direction gives the sign
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 12, scale: 2 }),
    amountUzs: numeric("amount_uzs", { precision: 18, scale: 2 }).notNull(), // Base-currency equivalent for reports
    method: paymentMethodEnum("method").default("cash").notNull(),
    // employee | supplier | client | other
    counterpartyType: varchar("counterparty_type", { length: 16 }).default("other").notNull(),
    employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    counterpartyName: varchar("counterparty_name", { length: 255 }),
    workOrderId: uuid("work_order_id").references(() => workOrders.id, { onDelete: "set null" }),
    // employee_advance | payroll_settlement | supplier_payment | client_payment | supplier_order_delivery | expense | manual
    sourceType: varchar("source_type", { length: 32 }).default("manual").notNull(),
    sourceId: uuid("source_id"),
    sourceDocNo: varchar("source_doc_no", { length: 64 }),
    status: varchar("status", { length: 16 }).default("posted").notNull(), // "posted" | "reversed"
    reversalOfId: uuid("reversal_of_id").references((): AnyPgColumn => cashTransactions.id, {
      onDelete: "restrict",
    }),
    note: text("note"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // A source document has at most one live posting; reversed postings and their storno rows
    // stay as history, so a corrected document can post again.
    uniqueIndex("cash_tx_source_uq")
      .on(table.companyId, table.sourceType, table.sourceId)
      .where(
        sql`${table.sourceId} IS NOT NULL AND ${table.reversalOfId} IS NULL AND ${table.status} = 'posted'`
      ),
    index("cash_tx_company_date_idx").on(table.companyId, table.date),
    index("cash_tx_account_idx").on(table.accountId),
    index("cash_tx_category_idx").on(table.categoryId),
    index("cash_tx_employee_idx").on(table.employeeId),
    index("cash_tx_supplier_idx").on(table.supplierId),
    index("cash_tx_work_order_idx").on(table.workOrderId),
  ]
);

export const cashCategoriesRelations = relations(cashCategories, ({ one, many }) => ({
  company: one(companies, {
    fields: [cashCategories.companyId],
    references: [companies.id],
  }),
  transactions: many(cashTransactions),
}));

export const cashTransactionsRelations = relations(cashTransactions, ({ one }) => ({
  company: one(companies, {
    fields: [cashTransactions.companyId],
    references: [companies.id],
  }),
  account: one(bankAccounts, {
    fields: [cashTransactions.accountId],
    references: [bankAccounts.id],
  }),
  category: one(cashCategories, {
    fields: [cashTransactions.categoryId],
    references: [cashCategories.id],
  }),
  employee: one(employees, {
    fields: [cashTransactions.employeeId],
    references: [employees.id],
  }),
  supplier: one(suppliers, {
    fields: [cashTransactions.supplierId],
    references: [suppliers.id],
  }),
  client: one(clients, {
    fields: [cashTransactions.clientId],
    references: [clients.id],
  }),
  workOrder: one(workOrders, {
    fields: [cashTransactions.workOrderId],
    references: [workOrders.id],
  }),
}));
