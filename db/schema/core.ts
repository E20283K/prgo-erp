import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums (1-Bosqich: Korxona Yo'nalishlari va Audit Amallari) ───────────────

export const industryTypeEnum = pgEnum("industry_type", [
  "printing", // PrintGoo Bosmaxona (Flexo, Offset, Yorliqlar)
  "textile",  // Tikuvchilik va Tekstil ishlab chiqarish
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "post",   // 1C uslubida hujjatni tasdiqlash (Проведение)
  "unpost", // Tasdiqni bekor qilish (Отмена проведения)
  "login",
  "logout",
]);

// ─── 1. Companies (Xolding tarkibidagi korxonalar) ────────────────────────────

export interface CompanySettings {
  timezone?: string;
  defaultTaxPercent?: number;
  allowNegativeStock?: boolean;
  workOrderPrefix?: string;
}

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    legalName: varchar("legal_name", { length: 255 }),
    industryType: industryTypeEnum("industry_type").default("printing").notNull(),
    inn: varchar("inn", { length: 32 }),
    baseCurrency: varchar("base_currency", { length: 3 }).default("UZS").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    settings: jsonb("settings").$type<CompanySettings>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("companies_code_uq").on(table.code),
    index("companies_industry_idx").on(table.industryType),
  ]
);

// ─── 2. Branches (Filiallar va Ishlab chiqarish sexlari) ──────────────────────

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 64 }),
    isMain: boolean("is_main").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("branches_company_code_uq").on(table.companyId, table.code),
    index("branches_company_idx").on(table.companyId),
  ]
);

// ─── 3. Audit Logs (O'chmas Tarix — Kim, Qachon, Nimani o'zgartirdi) ──────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    userId: varchar("user_id", { length: 128 }), // Keyingi bosqichda users jadvaliga ulanadi
    userName: varchar("user_name", { length: 255 }),
    entityType: varchar("entity_type", { length: 64 }).notNull(), // masalan: 'work_order', 'company'
    entityId: varchar("entity_id", { length: 128 }).notNull(),
    action: auditActionEnum("action").notNull(),
    oldData: jsonb("old_data").$type<Record<string, unknown> | null>(),
    newData: jsonb("new_data").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const companiesRelations = relations(companies, ({ many }) => ({
  branches: many(branches),
  auditLogs: many(auditLogs),
}));

export const branchesRelations = relations(branches, ({ one }) => ({
  company: one(companies, {
    fields: [branches.companyId],
    references: [companies.id],
  }),
}));

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
