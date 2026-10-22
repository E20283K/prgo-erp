import {
  pgTable,
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
import { companies, branches } from "./core";
import { employees } from "./hr";
import type {
  UserPermissions,
  UserScope,
  UserSecurity,
  UserStatus,
  ModulePermissionKey,
} from "@/components/documents/user/types";

// ─── 1. Users (Tizim Foydalanuvchilari) ────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    fullName: varchar("fullName", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).default("").notNull(),
    role: varchar("role", { length: 64 }).notNull(), // 'admin', 'manager', 'operator', etc.
    department: varchar("department", { length: 128 }).default("").notNull(),
    plant: varchar("plant", { length: 128 }).default("").notNull(),
    status: varchar("status", { length: 32 }).$type<UserStatus>().default("Active").notNull(),
    avatar: text("avatar"),
    initials: varchar("initials", { length: 8 }).default("").notNull(),
    language: varchar("language", { length: 8 }).$type<"uz" | "ru" | "en" | "tr">().default("uz").notNull(),
    defaultModule: varchar("default_module", { length: 64 }).$type<ModulePermissionKey>().default("production").notNull(),
    linkedEmployeeId: uuid("linked_employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),
    permissions: jsonb("permissions").$type<UserPermissions>().notNull(),
    scope: jsonb("scope").$type<UserScope>().notNull(),
    security: jsonb("security").$type<UserSecurity>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_username_uq").on(table.username),
    uniqueIndex("users_email_uq").on(table.email),
    uniqueIndex("users_code_uq").on(table.code),
    index("users_role_idx").on(table.role),
    index("users_status_idx").on(table.status),
    index("users_company_idx").on(table.companyId),
  ]
);

// ─── 2. User Sessions (Autentifikatsiya Sessiyalari) ──────────────────────────

export const userSessions = pgTable(
  "user_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 255 }).notNull(),
    ipAddress: varchar("ip_address", { length: 64 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_sessions_token_uq").on(table.token),
    index("user_sessions_user_idx").on(table.userId),
    index("user_sessions_expires_idx").on(table.expiresAt),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
  employee: one(employees, {
    fields: [users.linkedEmployeeId],
    references: [employees.id],
  }),
  sessions: many(userSessions),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

export type DbUser = typeof users.$inferSelect;
export type NewDbUser = typeof users.$inferInsert;
export type DbUserSession = typeof userSessions.$inferSelect;
export type NewDbUserSession = typeof userSessions.$inferInsert;
