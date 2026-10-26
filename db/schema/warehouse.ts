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
import { companies, branches } from "./core";
import { items } from "./master";
import { clients } from "./crm";

// ─── Enums: 1C Uslubidagi Ombor Holatlari va Turlari ──────────────────────────

export const warehouseTypeEnum = pgEnum("warehouse_type", [
  "raw_materials",   // Xomashyo ombori (Qog'oz, bo'yoq, plyonka, ximiya)
  "finished_goods",  // Tayyor mahsulotlar ombori
  "spare_parts",     // Ehtiyot qismlar va asbob-uskunalar (ZAPCHAST / Shtamplar)
  "hazmat_chemicals",// Xavfli kimyoviy moddalar (UB-lak, erituvchilar)
  "scrap_offcuts",   // Otxod va qoldiqlar (Delovoy otxod)
  "general",         // Umumiy / taqsimot ombori
]);

export const warehouseReceiptStatusEnum = pgEnum("warehouse_receipt_status", [
  "Draft",       // Qoralama
  "Inspecting",  // Nazoratda (Kirish sifat nazorati)
  "Quarantine",  // Karantinda (Brak yoki noaniq)
  "Accepted",    // Tasdiqlangan / Qabul qilingan (Provodka qilingan)
]);

export const warehouseShipmentStatusEnum = pgEnum("warehouse_shipment_status", [
  "Draft",       // Qoralama
  "Packed",      // Qadoqlangan
  "Dispatched",  // Jo'natilgan
  "In Transit",  // Yo'lda
  "Delivered",   // Yetkazildi / Topshirildi (Tasdiqlangan)
  "Cancelled",   // Bekor qilingan
]);

export const warehouseMovementStatusEnum = pgEnum("warehouse_movement_status", [
  "Pending",     // Kutilmoqda
  "In Transit",  // Yo'lda
  "Completed",   // Yakunlandi (Tasdiqlangan)
  "Cancelled",   // Bekor qilindi
]);

export const warehouseInventoryStatusEnum = pgEnum("warehouse_inventory_status", [
  "Draft",       // Qoralama
  "Matched",     // Mos keldi (Farqsiz)
  "Surplus",     // Ortiqcha (Kirim talab)
  "Shortage",    // Kamomad (Chiqim talab)
  "Completed",   // Yakunlangan
]);

export const stockStatusEnum = pgEnum("warehouse_stock_status", [
  "In Stock",    // Yetarli
  "Low Stock",   // Kam qolgan
  "Critical",    // Kritik kam
  "Out of Stock",// Tugagan
]);

export const finishedGoodStatusEnum = pgEnum("warehouse_finished_good_status", [
  "In Stock",    // Zaxirada
  "Reserved",    // Band qilingan
  "Shipped",     // Jo'natilgan
  "Scrapped",    // Yaroqsizga chiqarilgan
]);

// ─── 1. Warehouses (Omborlar Katalogi) ────────────────────────────────────────

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: varchar("code", { length: 32 }).notNull(), // Masalan: "WH-01", "MAIN", "FIN-SHOP"
    name: varchar("name", { length: 255 }).notNull(),
    type: warehouseTypeEnum("type").default("raw_materials").notNull(),
    address: text("address"),
    zones: integer("zones").default(1).notNull(),
    capacity: varchar("capacity", { length: 64 }), // Masalan: "85%", "5000 m2"
    managerName: varchar("manager_name", { length: 255 }),
    managerPhone: varchar("manager_phone", { length: 64 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("warehouses_company_code_uq").on(table.companyId, table.code),
    index("warehouses_company_idx").on(table.companyId),
    index("warehouses_type_idx").on(table.companyId, table.type),
  ]
);

// ─── 2. Warehouse Receipts (Kirim Hujjatlari) ──────────────────────────────────

export const warehouseReceipts = pgTable(
  "warehouse_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    receiptNumber: varchar("receipt_number", { length: 64 }).notNull(), // Masalan: "RCV-3001"
    receiptDate: timestamp("receipt_date", { withTimezone: true }).defaultNow().notNull(),
    supplierName: varchar("supplier_name", { length: 255 }).notNull(),
    poNumber: varchar("po_number", { length: 64 }), // Shartnoma yoki buyurtma raqami
    locationName: varchar("location_name", { length: 255 }), // Ombor yoki sektor nomi
    status: warehouseReceiptStatusEnum("status").default("Draft").notNull(),
    receivedBy: varchar("received_by", { length: 255 }),
    notes: text("notes"),
    totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).default("0").notNull(),
    currency: varchar("currency", { length: 3 }).default("UZS").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("receipts_company_number_uq").on(table.companyId, table.receiptNumber),
    index("receipts_company_date_idx").on(table.companyId, table.receiptDate),
    index("receipts_warehouse_idx").on(table.warehouseId),
  ]
);

export const warehouseReceiptItems = pgTable(
  "warehouse_receipt_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    receiptId: uuid("receipt_id")
      .notNull()
      .references(() => warehouseReceipts.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 64 }).default("Paper & Board").notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 32 }).default("sheets").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0").notNull(),
    sheetFormat: varchar("sheet_format", { length: 64 }),
    grammage: integer("grammage"),
    batchNumber: varchar("batch_number", { length: 64 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("receipt_items_receipt_idx").on(table.receiptId),
    index("receipt_items_sku_idx").on(table.sku),
  ]
);

// ─── 3. Warehouse Shipments (Chiqim Hujjatlari) ─────────────────────────────────

export const warehouseShipments = pgTable(
  "warehouse_shipments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    shipmentNumber: varchar("shipment_number", { length: 64 }).notNull(), // Masalan: "SHP-6001"
    shipmentDate: timestamp("shipment_date", { withTimezone: true }).defaultNow().notNull(),
    shipmentType: varchar("shipment_type", { length: 64 }).default("CustomerDelivery").notNull(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    workOrderId: varchar("work_order_id", { length: 128 }),
    deliveryActId: varchar("delivery_act_id", { length: 128 }),
    fromLocationName: varchar("from_location_name", { length: 255 }),
    status: warehouseShipmentStatusEnum("status").default("Draft").notNull(),
    carrier: varchar("carrier", { length: 255 }),
    driverName: varchar("driver_name", { length: 255 }),
    trackingNo: varchar("tracking_no", { length: 128 }),
    shippedBy: varchar("shipped_by", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("shipments_company_number_uq").on(table.companyId, table.shipmentNumber),
    index("shipments_company_date_idx").on(table.companyId, table.shipmentDate),
    index("shipments_warehouse_idx").on(table.warehouseId),
  ]
);

export const warehouseShipmentItems = pgTable(
  "warehouse_shipment_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => warehouseShipments.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    unit: varchar("unit", { length: 32 }).default("pcs").notNull(),
    unitPrice: numeric("unit_price", { precision: 15, scale: 2 }).default("0").notNull(),
    totalPrice: numeric("total_price", { precision: 15, scale: 2 }).default("0").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("shipment_items_shipment_idx").on(table.shipmentId),
    index("shipment_items_sku_idx").on(table.sku),
  ]
);

// ─── 4. Warehouse Movements (Ichki Ko'chirish Hujjatlari) ──────────────────────

export const warehouseMovements = pgTable(
  "warehouse_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    movementNumber: varchar("movement_number", { length: 64 }).notNull(), // Masalan: "MOV-4001"
    movementDate: timestamp("movement_date", { withTimezone: true }).defaultNow().notNull(),
    fromWarehouseId: uuid("from_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    toWarehouseId: uuid("to_warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    fromLocationName: varchar("from_location_name", { length: 255 }).notNull(),
    toLocationName: varchar("to_location_name", { length: 255 }).notNull(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    materialSku: varchar("material_sku", { length: 64 }),
    materialName: varchar("material_name", { length: 255 }).notNull(),
    sheetFormat: varchar("sheet_format", { length: 64 }),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    receivedQty: numeric("received_qty", { precision: 15, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("sheets").notNull(),
    reason: text("reason"),
    status: warehouseMovementStatusEnum("status").default("Pending").notNull(),
    operator: varchar("operator", { length: 255 }),
    workOrderId: varchar("work_order_id", { length: 128 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("movements_company_number_uq").on(table.companyId, table.movementNumber),
    index("movements_company_date_idx").on(table.companyId, table.movementDate),
    index("movements_status_idx").on(table.companyId, table.status),
  ]
);

// ─── 5. Warehouse Inventory Counts (Inventarizatsiya) ──────────────────────────

export const warehouseInventoryCounts = pgTable(
  "warehouse_inventory_counts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    locationName: varchar("location_name", { length: 255 }).notNull(),
    countNumber: varchar("count_number", { length: 64 }).notNull(), // Masalan: "IC-2026001"
    countDate: timestamp("count_date", { withTimezone: true }).defaultNow().notNull(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    materialSku: varchar("material_sku", { length: 64 }),
    materialName: varchar("material_name", { length: 255 }).notNull(),
    systemQty: numeric("system_qty", { precision: 15, scale: 3 }).default("0").notNull(),
    actualQty: numeric("actual_qty", { precision: 15, scale: 3 }).default("0").notNull(),
    variance: numeric("variance", { precision: 15, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("sheets").notNull(),
    status: warehouseInventoryStatusEnum("status").default("Draft").notNull(),
    countedBy: varchar("counted_by", { length: 255 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("inventory_company_number_uq").on(table.companyId, table.countNumber),
    index("inventory_company_date_idx").on(table.companyId, table.countDate),
  ]
);

// ─── 6. Warehouse Stock Balances (Jamg'arish Registri Snapshot) ────────────────

export const warehouseStockBalances = pgTable(
  "warehouse_stock_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    locationName: varchar("location_name", { length: 255 }).notNull(),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 64 }).default("Paper & Board").notNull(),
    sheetFormat: varchar("sheet_format", { length: 64 }),
    grammage: integer("grammage"),
    stockLevel: numeric("stock_level", { precision: 15, scale: 3 }).default("0").notNull(),
    reserved: numeric("reserved", { precision: 15, scale: 3 }).default("0").notNull(),
    available: numeric("available", { precision: 15, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("sheets").notNull(),
    reorder: numeric("reorder", { precision: 15, scale: 3 }).default("1000").notNull(),
    unitPriceUsd: numeric("unit_price_usd", { precision: 15, scale: 2 }).default("0").notNull(),
    locationShelf: varchar("location_shelf", { length: 128 }),
    imageUrl: text("image_url"),
    lastReceived: timestamp("last_received", { withTimezone: true }),
    status: stockStatusEnum("status").default("In Stock").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("stock_balance_company_location_sku_uq").on(table.companyId, table.locationName, table.sku),
    index("stock_balance_company_idx").on(table.companyId),
    index("stock_balance_sku_idx").on(table.companyId, table.sku),
  ]
);

// ─── 7. Warehouse Finished Goods (Tayyor Mahsulotlar Zaxirasi) ─────────────────

export const warehouseFinishedGoods = pgTable(
  "warehouse_finished_goods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    locationName: varchar("location_name", { length: 255 }),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    customerName: varchar("customer_name", { length: 255 }).notNull(),
    workOrderId: varchar("work_order_id", { length: 128 }),
    orderNo: varchar("order_no", { length: 64 }),
    productName: varchar("product_name", { length: 255 }).notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).default("0").notNull(),
    reservedQuantity: numeric("reserved_quantity", { precision: 15, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("pcs").notNull(),
    batchNo: varchar("batch_no", { length: 64 }),
    producedAt: timestamp("produced_at", { withTimezone: true }).defaultNow().notNull(),
    status: finishedGoodStatusEnum("status").default("In Stock").notNull(),
    locationShelf: varchar("location_shelf", { length: 128 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("finished_goods_company_sku_batch_uq").on(table.companyId, table.sku, table.workOrderId),
    index("finished_goods_company_idx").on(table.companyId),
    index("finished_goods_customer_idx").on(table.companyId, table.customerName),
  ]
);

// ─── Relations ────────────────────────────────────────────────────────────────

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  company: one(companies, {
    fields: [warehouses.companyId],
    references: [companies.id],
  }),
  branch: one(branches, {
    fields: [warehouses.branchId],
    references: [branches.id],
  }),
  receipts: many(warehouseReceipts),
  shipments: many(warehouseShipments),
  balances: many(warehouseStockBalances),
}));

export const warehouseReceiptsRelations = relations(warehouseReceipts, ({ one, many }) => ({
  company: one(companies, {
    fields: [warehouseReceipts.companyId],
    references: [companies.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseReceipts.warehouseId],
    references: [warehouses.id],
  }),
  items: many(warehouseReceiptItems),
}));

export const warehouseReceiptItemsRelations = relations(warehouseReceiptItems, ({ one }) => ({
  receipt: one(warehouseReceipts, {
    fields: [warehouseReceiptItems.receiptId],
    references: [warehouseReceipts.id],
  }),
  item: one(items, {
    fields: [warehouseReceiptItems.itemId],
    references: [items.id],
  }),
}));

export const warehouseShipmentsRelations = relations(warehouseShipments, ({ one, many }) => ({
  company: one(companies, {
    fields: [warehouseShipments.companyId],
    references: [companies.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseShipments.warehouseId],
    references: [warehouses.id],
  }),
  client: one(clients, {
    fields: [warehouseShipments.clientId],
    references: [clients.id],
  }),
  items: many(warehouseShipmentItems),
}));

export const warehouseShipmentItemsRelations = relations(warehouseShipmentItems, ({ one }) => ({
  shipment: one(warehouseShipments, {
    fields: [warehouseShipmentItems.shipmentId],
    references: [warehouseShipments.id],
  }),
  item: one(items, {
    fields: [warehouseShipmentItems.itemId],
    references: [items.id],
  }),
}));

export const warehouseMovementsRelations = relations(warehouseMovements, ({ one }) => ({
  company: one(companies, {
    fields: [warehouseMovements.companyId],
    references: [companies.id],
  }),
  fromWarehouse: one(warehouses, {
    fields: [warehouseMovements.fromWarehouseId],
    references: [warehouses.id],
  }),
  toWarehouse: one(warehouses, {
    fields: [warehouseMovements.toWarehouseId],
    references: [warehouses.id],
  }),
  item: one(items, {
    fields: [warehouseMovements.itemId],
    references: [items.id],
  }),
}));

export const warehouseInventoryCountsRelations = relations(warehouseInventoryCounts, ({ one }) => ({
  company: one(companies, {
    fields: [warehouseInventoryCounts.companyId],
    references: [companies.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseInventoryCounts.warehouseId],
    references: [warehouses.id],
  }),
}));

export const warehouseStockBalancesRelations = relations(warehouseStockBalances, ({ one }) => ({
  company: one(companies, {
    fields: [warehouseStockBalances.companyId],
    references: [companies.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseStockBalances.warehouseId],
    references: [warehouses.id],
  }),
  item: one(items, {
    fields: [warehouseStockBalances.itemId],
    references: [items.id],
  }),
}));

export const warehouseFinishedGoodsRelations = relations(warehouseFinishedGoods, ({ one }) => ({
  company: one(companies, {
    fields: [warehouseFinishedGoods.companyId],
    references: [companies.id],
  }),
  warehouse: one(warehouses, {
    fields: [warehouseFinishedGoods.warehouseId],
    references: [warehouses.id],
  }),
  client: one(clients, {
    fields: [warehouseFinishedGoods.clientId],
    references: [clients.id],
  }),
}));

// ─── 8. Carriers & Fleet (Tashuvchilar va Avtopark Katalogi) ───────────────────

export const carriers = pgTable(
  "carriers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 64 }).default("fleet").notNull(), // fleet, courier, self, other
    vehicleModel: varchar("vehicle_model", { length: 128 }),
    vehicleNo: varchar("vehicle_no", { length: 64 }),
    driverName: varchar("driver_name", { length: 255 }),
    driverPhone: varchar("driver_phone", { length: 64 }),
    isActive: boolean("is_active").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("carriers_company_idx").on(table.companyId),
    index("carriers_name_idx").on(table.companyId, table.name),
  ]
);

export const carriersRelations = relations(carriers, ({ one }) => ({
  company: one(companies, {
    fields: [carriers.companyId],
    references: [companies.id],
  }),
}));
