import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, branches } from "./core";
import { clients } from "./crm";

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "Draft",
  "Active",
  "Completed",
  "Cancelled",
]);

export const workOrderPriorityEnum = pgEnum("work_order_priority", [
  "Normal",
  "High",
  "Urgent",
]);

export const workOrderStageEnum = pgEnum("work_order_stage", [
  "Queue",
  "Ready to Print",
  "In Production",
  "Post-press",
  "Packaging",
  "Completed",
  "On Hold",
]);

export const workOrderTypeEnum = pgEnum("work_order_type", [
  "Production",
  "Sample",
  "Reprint",
]);

export const attachmentCategoryEnum = pgEnum("attachment_category", [
  "proofs",
  "artwork",
  "dieline",
  "docs",
]);

// ─── 1. Production Machines (Barcha texnologiyalar uchun uskunalar/stanoklar) ───

export const productionMachines = pgTable(
  "production_machines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),

    code: varchar("code", { length: 64 }).notNull(), // Masalan: "M-OFF-106"
    name: varchar("name", { length: 255 }).notNull(), // Masalan: "Heidelberg Speedmaster XL 106"
    department: varchar("department", { length: 64 }).notNull(), // "Offset" | "Flexo" | "Jacquard" | "Post-press"
    category: varchar("category", { length: 64 }), // "offset" | "flexo" | "die-cutting" | "lamination" | "guillotine" | "jacquard" | "mounting" | "casing-in"
    speed: varchar("speed", { length: 64 }), // "18,000 sheets/hr"
    format: varchar("format", { length: 64 }), // "B1 (750 × 1050 mm)"
    features: text("features"),
    manufacturer: varchar("manufacturer", { length: 255 }),
    country: varchar("country", { length: 128 }),
    year: integer("year"),
    serialNo: varchar("serial_no", { length: 128 }),
    location: varchar("location", { length: 255 }),
    leadOperator: varchar("lead_operator", { length: 128 }),
    assistantOperator: varchar("assistant_operator", { length: 128 }),
    shiftPattern: varchar("shift_pattern", { length: 128 }),
    hourlyRate: numeric("hourly_rate", { precision: 12, scale: 2 }).default("0"),
    powerKw: numeric("power_kw", { precision: 10, scale: 2 }).default("0"),
    overallEfficiency: integer("overall_efficiency").default(90),
    totalLifetimeCounter: numeric("total_lifetime_counter", { precision: 16, scale: 0 }).default("0"),
    counterUnit: varchar("counter_unit", { length: 32 }).default("sheets"),

    specs: jsonb("specs").$type<any>(),
    energy: jsonb("energy").$type<any>(),
    costing: jsonb("costing").$type<any>(),
    telemetry: jsonb("telemetry").$type<any>(),
    maintenanceLogs: jsonb("maintenance_logs").$type<any[]>().default([]),
    notes: text("notes"),

    status: varchar("status", { length: 64 }).default("Available").notNull(),
    isAvailable: boolean("is_available").default(true).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("production_machines_company_code_uq").on(table.companyId, table.code),
    index("production_machines_department_idx").on(table.department),
  ]
);

// ─── 2. Production Specifications (Master Retseptlar va Spetsifikatsiyalar) ────

export const productionSpecifications = pgTable(
  "production_specifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),

    code: varchar("code", { length: 64 }).notNull(), // Masalan: "SPEC-OFF-01"
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 64 }).default("Commercial Print").notNull(), // "Commercial Print" | "Packaging" | "Labels & Tags" | "Publishing" | "Stationery" | "Textile & Garment"
    department: varchar("department", { length: 64 }).notNull(), // "Offset" | "Flexo" | "Jacquard" | "Post-press"
    status: varchar("status", { length: 32 }).default("Active").notNull(), // "Active" | "Draft" | "Archived"
    version: varchar("version", { length: 32 }).default("1.0").notNull(),
    basePrice: numeric("base_price", { precision: 14, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 16 }).default("USD").notNull(),
    unit: varchar("unit", { length: 32 }).default("1k pcs").notNull(),
    description: text("description"),

    baseMaterial: varchar("base_material", { length: 255 }),
    dimensions: jsonb("dimensions").$type<{
      width?: number;
      height?: number;
      depth?: number;
      dimensionUnit?: string;
    }>().default({ width: 210, height: 297, depth: 0, dimensionUnit: "mm" }).notNull(),

    // Maxsus texnologik parametrlar (Offset / Flexo / Jacquard)
    techSpecs: jsonb("tech_specs").$type<Record<string, any>>().default({}).notNull(),

    materialsCount: integer("materials_count").default(0).notNull(),
    estimatedCost: varchar("estimated_cost", { length: 64 }).default("$0"),

    materials: jsonb("materials").$type<Array<{
      id?: string;
      name: string;
      spec?: string;
      quantity?: number;
      unit: string;
      unitPrice?: number;
      wastePercent?: number;
      stock?: number;
    }>>().default([]).notNull(),

    operations: jsonb("operations").$type<Array<{
      id?: string;
      name: string;
      machineStr?: string;
      durationHours?: number;
      operator?: string;
    }>>().default([]).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("production_specifications_code_uq").on(table.companyId, table.code),
    index("production_specifications_dept_idx").on(table.department),
    index("production_specifications_cat_idx").on(table.category),
    index("production_specifications_status_idx").on(table.status),
  ]
);

// ─── 3. Work Orders (Ishlab chiqarish buyruqlari) ──────────────────────────────

export const workOrders = pgTable(
  "work_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }),

    docNo: varchar("doc_no", { length: 64 }).notNull(), // Masalan: WO-00101
    clientOrderId: varchar("client_order_id", { length: 64 }), // Masalan: CO-00041
    customerName: varchar("customer_name", { length: 255 }).notNull(), // Mijoz nomi
    productName: varchar("product_name", { length: 255 }).notNull(), // Mahsulot nomi

    department: varchar("department", { length: 64 }).default("Offset").notNull(),
    site: varchar("site", { length: 128 }),
    pressMachine: varchar("press_machine", { length: 128 }),
    recipeCode: varchar("recipe_code", { length: 64 }),

    quantity: numeric("quantity", { precision: 14, scale: 2 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("pcs").notNull(),

    status: workOrderStatusEnum("status").default("Draft").notNull(),
    priority: workOrderPriorityEnum("priority").default("Normal").notNull(),
    stage: workOrderStageEnum("stage").default("Queue").notNull(),
    orderType: workOrderTypeEnum("order_type").default("Production").notNull(),

    startDate: varchar("start_date", { length: 32 }),
    deadline: varchar("deadline", { length: 32 }),

    paperStock: varchar("paper_stock", { length: 255 }),
    coating: varchar("coating", { length: 255 }),
    lamination: varchar("lamination", { length: 255 }),
    embellishment: varchar("embellishment", { length: 255 }),

    priceTotal: numeric("price_total", { precision: 16, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),

    operator: varchar("operator", { length: 128 }),
    shift: varchar("shift", { length: 64 }),

    photoUrl: text("photo_url"),
    photoUrls: jsonb("photo_urls").$type<string[]>().default([]).notNull(),

    // Texnik parametrlar (o'lchamlar, ruxlar, qoliplar, fayllar, tekshiruvlar)
    dimensions: jsonb("dimensions").$type<{
      width?: number;
      height?: number;
      dimensionUnit?: string;
      bleed?: number;
      shapeType?: string;
      cornerType?: string;
      itemCategory?: string;
      boxDepth?: number;
    }>().default({}).notNull(),

    colorsConfig: jsonb("colors_config").$type<{
      formula?: string;
      frontColors?: Record<string, boolean>;
      backColors?: Record<string, boolean>;
      spotColors?: string[];
      spotColorItems?: Array<{ id: string; name: string; code?: string; hex?: string; side?: string }>;
    }>().default({}).notNull(),

    checks: jsonb("checks").$type<{
      designReady?: boolean;
      paperReady?: boolean;
      platesReady?: boolean;
      toolingReady?: boolean;
      audit?: Record<string, { status: string; verifiedBy?: string; verifiedAt?: string }>;
    }>().default({
      designReady: false,
      paperReady: false,
      platesReady: false,
      toolingReady: false,
    }).notNull(),

    sampleData: jsonb("sample_data").$type<Record<string, unknown>>().default({}).notNull(),
    packagingData: jsonb("packaging_data").$type<Record<string, unknown>>().default({}).notNull(),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("work_orders_company_doc_no_uq").on(table.companyId, table.docNo),
    index("work_orders_company_idx").on(table.companyId),
    index("work_orders_client_idx").on(table.clientId),
    index("work_orders_stage_idx").on(table.stage),
    index("work_orders_status_idx").on(table.status),
    index("work_orders_priority_idx").on(table.priority),
  ]
);

// ─── 4. Work Order Operations (Texnologik marshrut operatsiyalari) ──────────────

export const workOrderOperations = pgTable(
  "work_order_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(), // Pechat, Lak, Kesim, Qadoqlash
    department: varchar("department", { length: 64 }),
    machineStr: varchar("machine_str", { length: 128 }),
    sequence: integer("sequence").default(1).notNull(),
    status: varchar("status", { length: 32 }).default("pending").notNull(),
    plannedQty: numeric("planned_qty", { precision: 14, scale: 2 }).default("0").notNull(),
    completedQty: numeric("completed_qty", { precision: 14, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("work_order_operations_wo_idx").on(table.workOrderId),
  ]
);

// ─── 5. Work Order Events & Pallet Logs (Timeline & Smena/Palet loglari) ────────

export const workOrderEvents = pgTable(
  "work_order_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    opId: varchar("op_id", { length: 64 }), // Marshrut operatsiyasi ID si
    time: varchar("time", { length: 32 }).notNull(), // "14:30"
    type: varchar("type", { length: 32 }).default("Run").notNull(), // "Setup" | "Run" | "Waste" | "QC" | "Delay"
    note: text("note").notNull(),
    operator: varchar("operator", { length: 128 }),
    wasteQty: integer("waste_qty").default(0),
    wasteReason: varchar("waste_reason", { length: 128 }),
    grossInput: integer("gross_input"),
    goodOutput: integer("good_output"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("work_order_events_wo_idx").on(table.workOrderId),
  ]
);

// ─── 6. Work Order Attachments (Fayllar va Hujjatlar Metadatasi) ───────────────

export const workOrderAttachments = pgTable(
  "work_order_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workOrderId: uuid("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    category: attachmentCategoryEnum("category").default("docs").notNull(), // proofs, artwork, dieline, docs
    fileType: varchar("file_type", { length: 128 }).notNull(),
    fileSize: varchar("file_size", { length: 64 }),
    storagePath: text("storage_path").notNull(), // Masalan: "PRINTGOO/orders/WO-00101/proofs/..."
    url: text("url").notNull(),
    uploadedBy: varchar("uploaded_by", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("work_order_attachments_wo_idx").on(table.workOrderId),
    index("work_order_attachments_cat_idx").on(table.category),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const productionMachinesRelations = relations(productionMachines, ({ one }) => ({
  company: one(companies, {
    fields: [productionMachines.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [productionMachines.branchId],
    references: [branches.id],
  }),
}));

export const productionSpecificationsRelations = relations(productionSpecifications, ({ one }) => ({
  company: one(companies, {
    fields: [productionSpecifications.companyId],
    references: [companies.id],
  }),
}));

export const workOrdersRelations = relations(workOrders, ({ one, many }) => ({
  company: one(companies, {
    fields: [workOrders.companyId],
    references: [companies.id],
  }),
  client: one(clients, {
    fields: [workOrders.clientId],
    references: [clients.id],
  }),
  operations: many(workOrderOperations),
  events: many(workOrderEvents),
  attachments: many(workOrderAttachments),
}));

export const workOrderOperationsRelations = relations(workOrderOperations, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderOperations.workOrderId],
    references: [workOrders.id],
  }),
}));

export const workOrderEventsRelations = relations(workOrderEvents, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderEvents.workOrderId],
    references: [workOrders.id],
  }),
}));

export const workOrderAttachmentsRelations = relations(workOrderAttachments, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderAttachments.workOrderId],
    references: [workOrders.id],
  }),
}));
