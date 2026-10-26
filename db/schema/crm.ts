import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./core";
import { employees } from "./hr";
import { workOrders } from "./production";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const leadStatusEnum = pgEnum("lead_status", [
  "New",
  "Contacted",
  "Sample Sent",
  "Qualified",
  "Converted",
  "Lost",
]);

export const supplierCategoryEnum = pgEnum("supplier_category", [
  "raw_materials",   // Qog'oz, karton, plyonka, xomashyo
  "cmyk_inks",       // Bo'yoq, lak, yelim, kimyo
  "ctp_prepress",    // CTP metall formalar, prepress xizmati
  "die_tooling",     // Shtamp, kesish qoliplari, pichoqlar
  "cliche_stamping", // Folga bosish va kongrev klishelari
  "outsourcing",     // Tashqi xizmatlar (Laminatsiya, UF-lak, Shelkografiya)
  "logistics",       // Logistika, kuryer, yuk tashish
  "spare_parts",     // Uskunalar ehtiyot qismlari va servis
  "other",           // Boshqa ta'minot
]);

export const supplierStatusEnum = pgEnum("supplier_status", [
  "Active",
  "Blocked",
  "Archived",
]);

export const supplierOrderStatusEnum = pgEnum("supplier_order_status", [
  "Draft",
  "Ordered",
  "In_Production",
  "Ready",
  "Delivered",
  "Cancelled",
]);

export const supplierOrderTypeEnum = pgEnum("supplier_order_type", [
  "die_tooling",   // Shtamp / Kesish qolipi
  "ctp_plates",    // CTP metall formalar
  "cliche",        // Folga / Kongrev klishe
  "raw_materials", // Qog'oz, bo'yoq, xomashyo
  "outsourcing",   // Autsorsing xizmati
  "service",       // Ta'mirlash / Servis
]);

export const clientTypeEnum = pgEnum("client_type", [
  "legal_entity", // Yuridik shaxs (MChJ, YaTT, XK va h.k.)
  "individual",   // Jismoniy shaxs
]);

export const clientStatusEnum = pgEnum("client_status", [
  "VIP",
  "Active",
  "New",
  "Blocked",
]);

export const contractTypeEnum = pgEnum("contract_type", [
  "annual",    // Yillik
  "one_time",  // Bir martalik
  "framework", // Bosh ramkali
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "active",
  "expired",
  "suspended",
]);

// ─── 1. Clients (Mijozlar / Kontragentlar) ────────────────────────────────────

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // Masalan: CUST-101
    name: varchar("name", { length: 255 }).notNull(), // Brend yoki qisqa nomi
    legalName: varchar("legal_name", { length: 255 }), // Rasmiy yuridik nomi (Masalan: OOO «ALPHA MEDIA»)
    clientType: clientTypeEnum("client_type").default("legal_entity").notNull(),
    tin: varchar("tin", { length: 32 }), // INN
    vatNumber: varchar("vat_number", { length: 64 }), // QQS to'lovchisi guvohnoma raqami
    vatPayer: boolean("vat_payer").default(false).notNull(),
    industry: varchar("industry", { length: 128 }), // Soha / Yo'nalish
    phone: varchar("phone", { length: 64 }),
    email: varchar("email", { length: 128 }),
    bankName: varchar("bank_name", { length: 255 }),
    bankAccount: varchar("bank_account", { length: 64 }), // 20208...
    mfo: varchar("mfo", { length: 16 }), // 5 xonali bank kodi
    oked: varchar("oked", { length: 16 }),
    legalAddress: text("legal_address"),
    deliveryAddress: text("delivery_address"),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(), // UZS yoki USD
    status: clientStatusEnum("status").default("New").notNull(),
    creditLimitUsd: numeric("credit_limit_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    paymentTerms: varchar("payment_terms", { length: 128 }), // Masalan: "50% Oldindan / 50% Yetkazilgach"
    managerName: varchar("manager_name", { length: 128 }),
    contactPerson: varchar("contact_person", { length: 128 }), // Asosiy aloqadagi shaxs
    receivingHours: text("receiving_hours"),
    requiresPowerOfAttorney: boolean("requires_power_of_attorney").default(true).notNull(),
    deliveryTransportNote: text("delivery_transport_note"),
    specialRequirements: text("special_requirements"),
    notes: text("notes"),
    contractNo: varchar("contract_no", { length: 64 }),
    contractDate: varchar("contract_date", { length: 32 }),
    contractExpiry: varchar("contract_expiry", { length: 32 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("clients_company_code_uq").on(table.companyId, table.code),
    index("clients_company_idx").on(table.companyId),
    index("clients_tin_idx").on(table.tin),
    index("clients_status_idx").on(table.status),
  ]
);

// ─── 2. Client Contacts (Mijozning Mas'ul Xodimlari) ──────────────────────────

export const clientContacts = pgTable(
  "client_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    role: varchar("role", { length: 64 }).notNull(), // 'director', 'accountant', 'procurement', 'designer', etc.
    roleLabel: varchar("role_label", { length: 128 }),
    phone: varchar("phone", { length: 64 }),
    email: varchar("email", { length: 128 }),
    telegram: varchar("telegram", { length: 128 }),
    isPrimary: boolean("is_primary").default(false).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("client_contacts_client_idx").on(table.clientId),
  ]
);

// ─── 3. Client Contracts (Mijozning Shartnomalari) ────────────────────────────

export const clientContracts = pgTable(
  "client_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    contractNo: varchar("contract_no", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    type: contractTypeEnum("type").default("annual").notNull(),
    startDate: varchar("start_date", { length: 32 }).notNull(),
    endDate: varchar("end_date", { length: 32 }),
    status: contractStatusEnum("status").default("active").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    paymentTerms: varchar("payment_terms", { length: 128 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("client_contracts_no_uq").on(table.clientId, table.contractNo),
    index("client_contracts_client_idx").on(table.clientId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const clientsRelations = relations(clients, ({ one, many }) => ({
  company: one(companies, {
    fields: [clients.companyId],
    references: [companies.id],
  }),
  contacts: many(clientContacts),
  contracts: many(clientContracts),
}));

export const clientContactsRelations = relations(clientContacts, ({ one }) => ({
  client: one(clients, {
    fields: [clientContacts.clientId],
    references: [clients.id],
  }),
}));

export const clientContractsRelations = relations(clientContracts, ({ one }) => ({
  client: one(clients, {
    fields: [clientContracts.clientId],
    references: [clients.id],
  }),
}));

// ─── 4. CRM Leads (Potensial Mijozlar / Lids) ─────────────────────────────────

export const crmLeads = pgTable(
  "crm_leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    leadNo: varchar("lead_no", { length: 32 }).notNull(), // LD-1001
    company: varchar("company", { length: 255 }).notNull(),
    tin: varchar("tin", { length: 32 }),
    contact: varchar("contact", { length: 128 }),
    phone: varchar("phone", { length: 64 }),
    email: varchar("email", { length: 128 }),
    productInterest: text("product_interest"),
    estimatedOrderUsd: numeric("estimated_order_usd", { precision: 14, scale: 2 }).default("0.00").notNull(),
    source: varchar("source", { length: 128 }),
    managerId: uuid("manager_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    managerName: varchar("manager_name", { length: 128 }),
    notes: text("notes"),
    status: leadStatusEnum("status").default("New").notNull(),
    convertedClientId: uuid("converted_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("crm_leads_company_no_uq").on(table.companyId, table.leadNo),
    index("crm_leads_company_idx").on(table.companyId),
    index("crm_leads_status_idx").on(table.status),
    index("crm_leads_tin_idx").on(table.tin),
  ]
);

export const crmLeadsRelations = relations(crmLeads, ({ one }) => ({
  company: one(companies, {
    fields: [crmLeads.companyId],
    references: [companies.id],
  }),
  manager: one(employees, {
    fields: [crmLeads.managerId],
    references: [employees.id],
  }),
  convertedClient: one(clients, {
    fields: [crmLeads.convertedClientId],
    references: [clients.id],
  }),
}));

// ─── 5. Suppliers & Partners (Ta'minotchilar, CTP, Shtamp, Xomashyo) ──────────

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // SUP-101
    name: varchar("name", { length: 255 }).notNull(), // Brend yoki qisqa nomi
    legalName: varchar("legal_name", { length: 255 }), // Rasmiy yuridik nomi
    category: supplierCategoryEnum("category").default("raw_materials").notNull(),
    tin: varchar("tin", { length: 32 }), // STIR / INN
    contactPerson: varchar("contact_person", { length: 128 }),
    phone: varchar("phone", { length: 64 }),
    email: varchar("email", { length: 128 }),
    bankName: varchar("bank_name", { length: 255 }),
    bankAccount: varchar("bank_account", { length: 64 }),
    mfo: varchar("mfo", { length: 16 }),
    openingBalance: numeric("opening_balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currentBalance: numeric("current_balance", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    paymentTerms: varchar("payment_terms", { length: 128 }),
    address: text("address"),
    notes: text("notes"),
    status: supplierStatusEnum("status").default("Active").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("suppliers_company_code_uq").on(table.companyId, table.code),
    index("suppliers_company_idx").on(table.companyId),
    index("suppliers_category_idx").on(table.category),
    index("suppliers_status_idx").on(table.status),
    index("suppliers_tin_idx").on(table.tin),
  ]
);

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  company: one(companies, {
    fields: [suppliers.companyId],
    references: [companies.id],
  }),
  orders: many(supplierOrders),
  contracts: many(supplierContracts),
}));

// ─── 6. Supplier Orders (Purchase Orders / CTP, Shtamp, Xomashyo Buyurtmalari) ──

export const supplierOrders = pgTable(
  "supplier_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    orderNo: varchar("order_no", { length: 64 }).notNull(), // PO-2026-001
    orderDate: varchar("order_date", { length: 32 }).notNull(),
    deliveryDeadline: varchar("delivery_deadline", { length: 32 }),
    orderType: supplierOrderTypeEnum("order_type").default("raw_materials").notNull(),
    title: varchar("title", { length: 255 }).notNull(), // Masalan: "4 ta CTP Forma (Choy qutisi uchun)"
    workOrderId: uuid("work_order_id").references(() => workOrders.id, {
      onDelete: "set null",
    }),
    workOrderNo: varchar("work_order_no", { length: 64 }),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).default("1.00").notNull(),
    unit: varchar("unit", { length: 32 }).default("dona").notNull(),
    amount: numeric("amount", { precision: 18, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    status: supplierOrderStatusEnum("status").default("Ordered").notNull(),
    specDetails: text("spec_details"), // "Format: 745x605mm, 4 rang (CMYK), 0.3mm metall"
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supplier_orders_company_no_uq").on(table.companyId, table.orderNo),
    index("supplier_orders_supplier_idx").on(table.supplierId),
    index("supplier_orders_work_order_idx").on(table.workOrderId),
    index("supplier_orders_status_idx").on(table.status),
    index("supplier_orders_date_idx").on(table.orderDate),
  ]
);

export const supplierOrdersRelations = relations(supplierOrders, ({ one }) => ({
  company: one(companies, {
    fields: [supplierOrders.companyId],
    references: [companies.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierOrders.supplierId],
    references: [suppliers.id],
  }),
  workOrder: one(workOrders, {
    fields: [supplierOrders.workOrderId],
    references: [workOrders.id],
  }),
}));

// ─── 7. Supplier Contracts (Ta'minotchi Shartnomalari) ────────────────────────

export const supplierContracts = pgTable(
  "supplier_contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    contractNo: varchar("contract_no", { length: 64 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    type: contractTypeEnum("type").default("annual").notNull(),
    startDate: varchar("start_date", { length: 32 }).notNull(),
    endDate: varchar("end_date", { length: 32 }),
    status: contractStatusEnum("status").default("active").notNull(),
    paymentTerms: varchar("payment_terms", { length: 128 }),
    currency: varchar("currency", { length: 8 }).default("UZS").notNull(),
    attachmentName: varchar("attachment_name", { length: 255 }),
    attachmentUrl: text("attachment_url"),
    attachmentSize: varchar("attachment_size", { length: 64 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("supplier_contracts_supplier_no_uq").on(table.supplierId, table.contractNo),
    index("supplier_contracts_supplier_idx").on(table.supplierId),
    index("supplier_contracts_company_idx").on(table.companyId),
    index("supplier_contracts_status_idx").on(table.status),
  ]
);

export const supplierContractsRelations = relations(supplierContracts, ({ one }) => ({
  company: one(companies, {
    fields: [supplierContracts.companyId],
    references: [companies.id],
  }),
  supplier: one(suppliers, {
    fields: [supplierContracts.supplierId],
    references: [suppliers.id],
  }),
}));



