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
import { companies, branches } from "./core";
import { clients } from "./crm";

// ─── Enums: Bosmaxona Holatlari & Uskunalar ────────────────────────────────────

export const machineStatusEnum = pgEnum("machine_status", [
  "active",      // Ishchi holatda
  "maintenance", // Profilaktika yoki ta'mirda
  "idle",        // Bo'sh turibdi
]);

export const toolingStatusEnum = pgEnum("tooling_status", [
  "available",   // Ishlatishga tayyor (ombor/stellajda)
  "in_use",      // Stanokda o'rnatilgan
  "sharpening",  // O'tkirlashda / ta'mirda
  "retired",     // Hisobdan chiqarilgan (eskirgan)
]);

export const dieShapeEnum = pgEnum("die_shape", [
  "rectangle",   // To'rtburchak
  "rounded_rect",// Burchaklari radiusli to'rtburchak
  "circle",      // Aylana / Doira
  "oval",        // Oval
  "custom",      // Maxsus figurali kontur
]);

export const dieTypeEnum = pgEnum("die_type", [
  "rotary_magnetic", // Magnit val uchun egiluvchan pichoq (Flexible Die)
  "solid_rotary",    // Butun po'lat aylanma pichoq (Solid Rotary Die)
  "flatbed",         // Tekis shtamp (Tigel / Plotter)
  "hot_stamp",       // Issiq zarb shtampi (Klische)
  "embossing",       // Bo'rtma bosish shtampi (Kongrev)
]);

// ─── 1. Pantone Colors (Pantone va Maxsus Bo'yoqlar Katalogi) ──────────────────

export const pantoneColors = pgTable(
  "pantone_colors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: varchar("code", { length: 32 }).notNull(), // masalan: "021 C", "Warm Red C", "871 C"
    name: varchar("name", { length: 128 }).notNull(), // masalan: "PANTONE 021 C (Neon Orange)"
    hex: varchar("hex", { length: 16 }).notNull(), // masalan: "#fe5000"
    category: varchar("category", { length: 64 }).notNull(), // "Base Inks", "PMS Solid Coated", "Metallics & Pastels", "Specialty & Foils"
    cmykEstimate: jsonb("cmyk_estimate").$type<{ c: number; m: number; y: number; k: number }>(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("pantone_code_uq").on(table.code),
    index("pantone_category_idx").on(table.category),
    index("pantone_name_idx").on(table.name),
  ]
);

// ─── 2. Flexo Machines (Fleksografik Bosma Stanoklari) ─────────────────────────

export const flexoMachines = pgTable(
  "flexo_machines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(), // masalan: "JR-1521", "GALLUS-EM280"
    name: varchar("name", { length: 255 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    gearSystem: varchar("gear_system", { length: 128 }).notNull(), // masalan: "JR-1521 Pitch 2.7107mm", "1/8 CP (3.175mm)"
    gearPitch: numeric("gear_pitch", { precision: 8, scale: 4 }), // Masalan: 2.7107 yoki 3.1750 mm
    minWebWidth: numeric("min_web_width", { precision: 8, scale: 2 }).notNull(), // mm
    maxWebWidth: numeric("max_web_width", { precision: 8, scale: 2 }).notNull(), // mm
    maxPrintWidth: numeric("max_print_width", { precision: 8, scale: 2 }).notNull(), // mm
    standardPlateThickness: numeric("standard_plate_thickness", {
      precision: 6,
      scale: 3,
    })
      .default("1.700")
      .notNull(), // mm (odatda 1.70 mm)
    colorStations: integer("color_stations").default(4).notNull(), // Pechat seksiyalari soni
    speedMpm: numeric("speed_mpm", { precision: 8, scale: 2 }).default("80").notNull(), // Maksimal tezlik m/min
    status: machineStatusEnum("status").default("active").notNull(),
    hourlyRate: numeric("hourly_rate", { precision: 15, scale: 2 }).default("0").notNull(), // Soatlik amortizatsiya/ish narxi
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("flexo_machines_company_code_uq").on(table.companyId, table.code),
    index("flexo_machines_company_idx").on(table.companyId),
    index("flexo_machines_status_idx").on(table.status),
  ]
);

// ─── 3. Flexo Cylinders (Format Vallari / Bosma Silindrlar) ────────────────────

export const flexoCylinders = pgTable(
  "flexo_cylinders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    machineId: uuid("machine_id").references(() => flexoMachines.id, {
      onDelete: "set null",
    }),
    teeth: integer("teeth").notNull(), // Tishlar soni (Z), masalan: 40 dan 149 gacha
    pitchCircleDiameter: numeric("pitch_circle_diameter", {
      precision: 8,
      scale: 3,
    }).notNull(), // Bo'luvchi diametr (mm)
    plateThickness: numeric("plate_thickness", {
      precision: 6,
      scale: 3,
    }).notNull(), // Klishe qalinligi (mm), masalan: 1.70
    cylinderDiameter: numeric("cylinder_diameter", {
      precision: 8,
      scale: 3,
    }).notNull(), // Valning jismoniy diametri (mm)
    filmLength: numeric("film_length", { precision: 8, scale: 3 }).notNull(), // Plyonka / Maket aylanasi (mm)
    printingLength: numeric("printing_length", { precision: 8, scale: 3 }).notNull(), // Pechat aylanasi (mm)
    quantity: integer("quantity").default(1).notNull(), // Mavjud vallar soni
    location: varchar("location", { length: 64 }), // Sexdagi javon/stellaj (masalan: "CYL-RACK-02")
    status: varchar("status", { length: 32 }).default("ready").notNull(), // "ready", "in_use", "damaged"
    needsVerification: boolean("needs_verification").default(false).notNull(),
    verificationNote: text("verification_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("flexo_cylinders_teeth_uq").on(
      table.companyId,
      table.machineId,
      table.teeth,
      table.plateThickness
    ),
    index("flexo_cylinders_teeth_idx").on(table.teeth),
    index("flexo_cylinders_machine_idx").on(table.machineId),
  ]
);

// ─── 4. Dies & Tooling (Pichoqlar, Shtamplar va Qoliplar) ──────────────────────

export const diesTooling = pgTable(
  "dies_tooling",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 64 }).notNull(), // Pichoq kodi (masalan: "DIE-RECT-50x90-R3")
    name: varchar("name", { length: 255 }).notNull(),
    dieType: dieTypeEnum("die_type").default("rotary_magnetic").notNull(),
    shape: dieShapeEnum("shape").default("rectangle").notNull(),
    widthMm: numeric("width_mm", { precision: 8, scale: 2 }).notNull(), // Yorliq eni
    heightMm: numeric("height_mm", { precision: 8, scale: 2 }).notNull(), // Yorliq balandligi
    cornerRadiusMm: numeric("corner_radius_mm", { precision: 6, scale: 2 })
      .default("0")
      .notNull(),
    acrossCount: integer("across_count").default(1).notNull(), // Qatordagi ruxlar soni (ko'ndalang)
    aroundCount: integer("around_count").default(1).notNull(), // Aylanadagi ruxlar soni (bo'ylama)
    gapXMm: numeric("gap_x_mm", { precision: 6, scale: 2 }).default("3.0").notNull(),
    gapYMm: numeric("gap_y_mm", { precision: 6, scale: 2 }).default("3.0").notNull(),
    repeatLengthMm: numeric("repeat_length_mm", { precision: 8, scale: 3 }), // Takrorlanish uzunligi
    cylinderTeeth: integer("cylinder_teeth"), // Mos silindr Z tishlari
    location: varchar("location", { length: 64 }), // Stellaj yoki quti raqami (masalan: "SHELF-B3")
    status: toolingStatusEnum("status").default("available").notNull(),
    totalImpressions: integer("total_impressions").default(0).notNull(), // Ishlagan zarblar soni
    maxImpressions: integer("max_impressions"), // Resurs chegarasi
    notes: text("notes"),

    // Mijozga biriktirish & Egalik (Customer Dedicated / In-house)
    customerId: uuid("customer_id").references(() => clients.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 255 }), // Qidiruv va ko'rinish qulayligi uchun mijoz nomi
    ownership: varchar("ownership", { length: 32 }).default("in_house").notNull(), // "in_house" | "customer_owned"
    isDedicated: boolean("is_dedicated").default(false).notNull(), // true = faqat shu mijozga tegishli

    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("dies_tooling_company_code_uq").on(table.companyId, table.code),
    index("dies_tooling_company_shape_idx").on(table.companyId, table.shape),
    index("dies_tooling_status_idx").on(table.status),
    index("dies_tooling_customer_idx").on(table.customerId),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const flexoMachinesRelations = relations(flexoMachines, ({ one, many }) => ({
  company: one(companies, {
    fields: [flexoMachines.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [flexoMachines.branchId],
    references: [branches.id],
  }),
  cylinders: many(flexoCylinders),
}));

export const flexoCylindersRelations = relations(flexoCylinders, ({ one }) => ({
  company: one(companies, {
    fields: [flexoCylinders.companyId],
    references: [companies.id],
  }),
  machine: one(flexoMachines, {
    fields: [flexoCylinders.machineId],
    references: [flexoMachines.id],
  }),
}));

export const diesToolingRelations = relations(diesTooling, ({ one }) => ({
  company: one(companies, {
    fields: [diesTooling.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [diesTooling.customerId],
    references: [clients.id],
  }),
}));

export type PantoneColor = typeof pantoneColors.$inferSelect;
export type NewPantoneColor = typeof pantoneColors.$inferInsert;
export type FlexoMachine = typeof flexoMachines.$inferSelect;
export type NewFlexoMachine = typeof flexoMachines.$inferInsert;
export type FlexoCylinder = typeof flexoCylinders.$inferSelect;
export type NewFlexoCylinder = typeof flexoCylinders.$inferInsert;
export type DieTooling = typeof diesTooling.$inferSelect;
export type NewDieTooling = typeof diesTooling.$inferInsert;
