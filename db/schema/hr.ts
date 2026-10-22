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
  date,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, branches } from "./core";

// ─── Enums (Kadrlar va Ish Haqi Turlari) ───────────────────────────────────────

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",      // Faol ishlamoqda
  "on_leave",    // Mehnat yoki kasallik ta'tilida
  "probation",   // Sinov muddatida
  "terminated",  // Ishdan bo'shatilgan
]);

export const wageTypeEnum = pgEnum("wage_type", [
  "salary",      // Sobit oklad (Oylik)
  "piecework",   // Ishbay (Сдельная оплата труда - bosilgan tiraj/dona)
  "hourly",      // Soatbay stavka
  "mixed",       // Aralash: Oklad + Ishbay bonus
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",     // Kelgan
  "late",        // Kechikkan
  "absent",      // Kelmagan (sababsiz)
  "sick_leave",  // Kasallik varaqasi (Byulleten)
  "vacation",    // Mehnat ta'tili
  "day_off",     // Dam olish kuni
]);

export const pieceworkStatusEnum = pgEnum("piecework_status", [
  "draft",       // Qoralama
  "verified",    // Sex masteri / OTK tasdiqlagan
  "approved",    // Buxgalteriya oylikka kiritgan
  "paid",        // To'langan
]);

export const payrollStatusEnum = pgEnum("payroll_status", [
  "draft",       // Hisoblash jarayonida
  "calculated",  // Hisoblab chiqilgan
  "approved",    // Rahbariyat tasdiqlagan (Проведено)
  "paid",        // To'liq to'langan
]);

// ─── 1. Departments & Workshops (Sexlar va Bo'limlar) ─────────────────────────

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(), // masalan: "DEP-FLEXO", "DEP-SEWING"
    name: varchar("name", { length: 255 }).notNull(), // "Flekso bosma sexi", "Tikuvchilik sexi"
    description: text("description"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("departments_company_code_uq").on(table.companyId, table.code),
    index("departments_company_idx").on(table.companyId),
  ]
);

// ─── 2. Positions (Lavozimlar va Shtat Birliklari) ─────────────────────────────

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(), // masalan: "POS-PRINTER-M", "POS-CUTTER"
    title: varchar("title", { length: 255 }).notNull(), // "Katta pechatnik", "Tikuvchi-operator"
    defaultWageType: wageTypeEnum("default_wage_type").default("piecework").notNull(),
    standardRate: numeric("standard_rate", { precision: 15, scale: 2 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("positions_company_code_uq").on(table.companyId, table.code),
    index("positions_department_idx").on(table.departmentId),
  ]
);

// ─── 3. Employees (Xodimlar Shaxsiy Kartochkalari) ────────────────────────────

export interface EmployeeMetadata {
  passportSeries?: string;
  passportNumber?: string;
  pinfl?: string; // JSHSHIR
  birthDate?: string;
  gender?: "male" | "female";
  emergencyPhone?: string;
  bankCardNo?: string;
  bankName?: string;
  address?: string;
  education?: string;
  uniformSize?: string;
  skills?: string[];
  [key: string]: unknown;
}

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),
    positionId: uuid("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    badgeNumber: varchar("badge_number", { length: 32 }).notNull(), // Tabel raqami: EMP-0012
    firstName: varchar("first_name", { length: 128 }).notNull(),
    lastName: varchar("last_name", { length: 128 }).notNull(),
    middleName: varchar("middle_name", { length: 128 }),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 64 }).notNull(),
    email: varchar("email", { length: 128 }),
    status: employeeStatusEnum("status").default("active").notNull(),
    wageType: wageTypeEnum("wage_type").default("mixed").notNull(),
    baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).default("0").notNull(),
    pieceworkMultiplier: numeric("piecework_multiplier", { precision: 5, scale: 2 }).default("1.00").notNull(),
    hourlyRate: numeric("hourly_rate", { precision: 15, scale: 2 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    hireDate: date("hire_date").notNull(),
    terminationDate: date("termination_date"),
    currentShift: varchar("current_shift", { length: 32 }).default("day"), // "day", "night", "2/2"
    avatarUrl: text("avatar_url"),
    details: jsonb("details").$type<EmployeeMetadata>().default({}).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("employees_company_badge_uq").on(table.companyId, table.badgeNumber),
    index("employees_company_department_idx").on(table.companyId, table.departmentId),
    index("employees_company_status_idx").on(table.companyId, table.status),
  ]
);

// ─── 4. Shifts (Smenalar Rejimi) ──────────────────────────────────────────────

export const shifts = pgTable(
  "shifts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(), // masalan: "SHIFT-DAY-12", "SHIFT-OFFICE-8"
    name: varchar("name", { length: 255 }).notNull(),
    startTime: varchar("start_time", { length: 8 }).notNull(), // "08:00"
    endTime: varchar("end_time", { length: 8 }).notNull(), // "20:00"
    durationHours: numeric("duration_hours", { precision: 4, scale: 2 }).default("12.00").notNull(),
    shiftType: varchar("shift_type", { length: 16 }).default("day").notNull(), // "day" | "night" | "daily"
    activeWorkers: integer("active_workers").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shifts_company_code_uq").on(table.companyId, table.code),
    index("shifts_company_idx").on(table.companyId),
  ]
);

// ─── 5. Employee Shift Assignments (Xodimlarni Smenaga Biriktirish) ───────────

export const employeeShiftAssignments = pgTable(
  "employee_shift_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shifts.id, { onDelete: "restrict" }),
    effectiveFrom: date("effective_from").notNull(),
    effectiveTo: date("effective_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("emp_shift_employee_idx").on(table.employeeId),
    index("emp_shift_shift_idx").on(table.shiftId),
  ]
);

// ─── 6. Attendance & Timesheet (T-13 Tabel Hisobi) ────────────────────────────

export const attendanceLogs = pgTable(
  "attendance_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    workDate: date("work_date").notNull(),
    shiftType: varchar("shift_type", { length: 32 }).default("day").notNull(), // "day_12h", "night_12h", "standard_8h"
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    workedHours: numeric("worked_hours", { precision: 4, scale: 2 }).default("0").notNull(),
    overtimeHours: numeric("overtime_hours", { precision: 4, scale: 2 }).default("0").notNull(),
    delayMinutes: integer("delay_minutes").default(0).notNull(),
    status: attendanceStatusEnum("status").default("present").notNull(),
    sourceDevice: varchar("source_device", { length: 64 }).default("biometric_turnstile"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("attendance_emp_date_shift_uq").on(table.employeeId, table.workDate, table.shiftType),
    index("attendance_work_date_idx").on(table.companyId, table.workDate),
  ]
);

// ─── 7. Piecework Wages (Ishlab Chiqarishdan Ishbay Hisobi - Сдельный Наряд) ───

export const pieceworkLogs = pgTable(
  "piecework_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    workOrderId: varchar("work_order_id", { length: 64 }).notNull(), // Bog'langan naryad raqami (masalan: WOOF-26-0351)
    workDate: date("work_date").notNull(),
    machineCode: varchar("machine_code", { length: 64 }), // masalan: "FLEXO-MARKANDY-01"
    operationCode: varchar("operation_code", { length: 64 }).notNull(), // masalan: "PRINT_FLEXO", "DIE_CUT", "SEW_LABEL"
    operationName: varchar("operation_name", { length: 255 }).notNull(),
    completedQuantity: numeric("completed_quantity", { precision: 12, scale: 2 }).notNull(),
    unit: varchar("unit", { length: 16 }).default("dona").notNull(),
    pieceRate: numeric("piece_rate", { precision: 12, scale: 4 }).notNull(), // 1 birlik uchun to'lov summasi
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    status: pieceworkStatusEnum("status").default("verified").notNull(),
    approvedBy: varchar("approved_by", { length: 128 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("piecework_employee_date_idx").on(table.employeeId, table.workDate),
    index("piecework_work_order_idx").on(table.workOrderId),
    index("piecework_status_idx").on(table.status),
  ]
);

// ─── 8. Employee Advances & Loans (Avans va Qarzlar) ──────────────────────────

export const employeeAdvances = pgTable(
  "employee_advances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    advanceDate: date("advance_date").notNull(),
    period: varchar("period", { length: 7 }).notNull(), // "2026-10"
    status: varchar("status", { length: 16 }).default("pending").notNull(), // "pending" | "deducted" | "cancelled"
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("advances_emp_period_idx").on(table.employeeId, table.period),
    index("advances_company_idx").on(table.companyId),
  ]
);

// ─── 9. Payroll Adjustments (Bonus, Jarima, Soliq, Ta'til) ────────────────────

export const payrollAdjustments = pgTable(
  "payroll_adjustments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    period: varchar("period", { length: 7 }).notNull(), // "2026-10"
    adjustmentType: varchar("adjustment_type", { length: 32 }).notNull(), // "bonus" | "penalty" | "tax_inps" | "tax_income" | "vacation_pay"
    amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("payroll_adj_emp_period_idx").on(table.employeeId, table.period),
    index("payroll_adj_company_idx").on(table.companyId),
  ]
);

// ─── 10. Monthly Payroll Records (Oylik Ish Haqi Hisob-Kitobi) ────────────────

export const payrollRecords = pgTable(
  "payroll_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    period: varchar("period", { length: 7 }).notNull(), // "2026-10"
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    baseSalary: numeric("base_salary", { precision: 15, scale: 2 }).default("0").notNull(),
    pieceworkAmount: numeric("piecework_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    overtimeAmount: numeric("overtime_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    bonusAmount: numeric("bonus_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    grossPay: numeric("gross_pay", { precision: 15, scale: 2 }).notNull(), // Jami hisoblangan
    advanceDeduction: numeric("advance_deduction", { precision: 15, scale: 2 }).default("0").notNull(),
    taxDeduction: numeric("tax_deduction", { precision: 15, scale: 2 }).default("0").notNull(),
    penaltyDeduction: numeric("penalty_deduction", { precision: 15, scale: 2 }).default("0").notNull(),
    totalDeductions: numeric("total_deductions", { precision: 15, scale: 2 }).notNull(),
    netPay: numeric("net_pay", { precision: 15, scale: 2 }).notNull(), // Qo'lga tegadigan summa
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    status: payrollStatusEnum("status").default("calculated").notNull(),
    paymentDate: date("payment_date"),
    paymentMethod: varchar("payment_method", { length: 32 }).default("bank_card"), // "bank_card", "cash"
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("payroll_emp_period_uq").on(table.employeeId, table.period),
    index("payroll_period_idx").on(table.companyId, table.period),
    index("payroll_status_idx").on(table.status),
  ]
);

// ─── 11. Employee History (Kadrlar Harakati Tarixi) ───────────────────────────

export const employeeHistory = pgTable(
  "employee_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    changeType: varchar("change_type", { length: 32 }).notNull(), // "position_change" | "salary_change" | "department_change" | "status_change"
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    changedBy: varchar("changed_by", { length: 128 }),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("emp_history_emp_idx").on(table.employeeId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [departments.branchId],
    references: [branches.id],
  }),
  positions: many(positions),
  employees: many(employees),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  department: one(departments, {
    fields: [positions.departmentId],
    references: [departments.id],
  }),
  employees: many(employees),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  company: one(companies, {
    fields: [shifts.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [shifts.branchId],
    references: [branches.id],
  }),
  assignments: many(employeeShiftAssignments),
}));

export const employeeShiftAssignmentsRelations = relations(employeeShiftAssignments, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeShiftAssignments.employeeId],
    references: [employees.id],
  }),
  shift: one(shifts, {
    fields: [employeeShiftAssignments.shiftId],
    references: [shifts.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [employees.branchId],
    references: [branches.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  position: one(positions, {
    fields: [employees.positionId],
    references: [positions.id],
  }),
  attendanceLogs: many(attendanceLogs),
  pieceworkLogs: many(pieceworkLogs),
  payrollRecords: many(payrollRecords),
  advances: many(employeeAdvances),
  payrollAdjustments: many(payrollAdjustments),
  shiftAssignments: many(employeeShiftAssignments),
  history: many(employeeHistory),
}));

export const attendanceLogsRelations = relations(attendanceLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [attendanceLogs.employeeId],
    references: [employees.id],
  }),
}));

export const pieceworkLogsRelations = relations(pieceworkLogs, ({ one }) => ({
  employee: one(employees, {
    fields: [pieceworkLogs.employeeId],
    references: [employees.id],
  }),
}));

export const payrollRecordsRelations = relations(payrollRecords, ({ one }) => ({
  employee: one(employees, {
    fields: [payrollRecords.employeeId],
    references: [employees.id],
  }),
}));

export const employeeAdvancesRelations = relations(employeeAdvances, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeAdvances.employeeId],
    references: [employees.id],
  }),
}));

export const payrollAdjustmentsRelations = relations(payrollAdjustments, ({ one }) => ({
  employee: one(employees, {
    fields: [payrollAdjustments.employeeId],
    references: [employees.id],
  }),
}));

export const employeeHistoryRelations = relations(employeeHistory, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeHistory.employeeId],
    references: [employees.id],
  }),
}));

// ─── Schema Inferred Types ────────────────────────────────────────────────────

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type AttendanceLog = typeof attendanceLogs.$inferSelect;
export type NewAttendanceLog = typeof attendanceLogs.$inferInsert;
export type PieceworkLog = typeof pieceworkLogs.$inferSelect;
export type NewPieceworkLog = typeof pieceworkLogs.$inferInsert;
export type EmployeeAdvance = typeof employeeAdvances.$inferSelect;
export type NewEmployeeAdvance = typeof employeeAdvances.$inferInsert;
export type PayrollAdjustment = typeof payrollAdjustments.$inferSelect;
export type NewPayrollAdjustment = typeof payrollAdjustments.$inferInsert;
export type PayrollRecordDb = typeof payrollRecords.$inferSelect;
export type NewPayrollRecordDb = typeof payrollRecords.$inferInsert;
export type EmployeeHistoryRecord = typeof employeeHistory.$inferSelect;
export type NewEmployeeHistoryRecord = typeof employeeHistory.$inferInsert;
