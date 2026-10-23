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
import { companies } from "./core";
import { users } from "./users";

// ─── Enums: Bildirishnoma Darajalari va Bo'limlari ────────────────────────────

export const notificationSeverityEnum = pgEnum("notification_severity", [
  "info",
  "success",
  "warning",
  "error",
]);

export const notificationCategoryEnum = pgEnum("notification_category", [
  "production",
  "warehouse",
  "finance",
  "crm",
  "system",
]);

// ─── 1. Notifications (ERP Tizim Bildirishnomalari) ──────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    recipientUserId: uuid("recipient_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    recipientRole: varchar("recipient_role", { length: 64 }).default("all").notNull(),
    dedupKey: varchar("dedup_key", { length: 128 }),
    severity: notificationSeverityEnum("severity").default("info").notNull(),
    category: notificationCategoryEnum("category").default("system").notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    entityCode: varchar("entity_code", { length: 64 }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    i18nKey: varchar("i18n_key", { length: 64 }),
    i18nParams: jsonb("i18n_params").$type<Record<string, string | number>>(),
    link: jsonb("link").$type<{ module: string; subModule: string }>(),
    targetTab: jsonb("target_tab").$type<Record<string, unknown>>(),
    isRead: boolean("is_read").default(false).notNull(),
    isDismissed: boolean("is_dismissed").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("notifications_company_dedup_uq").on(table.companyId, table.dedupKey),
    index("notifications_company_created_idx").on(table.companyId, table.createdAt),
    index("notifications_company_read_idx").on(table.companyId, table.isRead),
    index("notifications_company_dismissed_idx").on(table.companyId, table.isDismissed),
    index("notifications_category_idx").on(table.category),
    index("notifications_severity_idx").on(table.severity),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const notificationsRelations = relations(notifications, ({ one }) => ({
  company: one(companies, {
    fields: [notifications.companyId],
    references: [companies.id],
  }),
  recipientUser: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

export type DbNotification = typeof notifications.$inferSelect;
export type NewDbNotification = typeof notifications.$inferInsert;
