import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  numeric,
  integer,
  doublePrecision,
  jsonb,
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

export const warehouseDispatchManifestStatusEnum = pgEnum("warehouse_manifest_status", [
  "Draft",       // Qoralama
  "Loading",     // Yuklanmoqda
  "Dispatched",  // Jo'natilgan / Yo'lda
  "Delivered",   // Yetkazildi
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

export const wmsZoneTypeEnum = pgEnum("wms_zone_type", [
  "storage",     // Asosiy saqlash zonasi
  "receiving",   // Qabul qilish / Rampa
  "shipping",    // Yuklash / Jo'natish
  "staging",     // Vaqtinchalik oraliq zona
  "quarantine",  // Karantin / Brak zonasi
]);

export const wmsMapElementTypeEnum = pgEnum("wms_map_element_type", [
  "rack",        // Stelaj
  "zone",        // Sektor/zona chegarasi
  "aisle",       // Yo'lak (yo'l)
  "gate",        // Rampa / Darvoza
  "pillar",      // Ustun / To'siq
  "wall",        // Devor
]);

export const wmsRackTypeEnum = pgEnum("wms_rack_type", [
  "pallet",      // Paletli stelaj
  "shelf",       // Polkali stelaj
  "cantilever",  // Konsol stelaj
  "roll_stand",  // Rulon stendi
  "floor_stack", // Poldagi maydon
  "obstacle",    // To'siq / Ustun
  "gate",        // Rampa / Darvoza
]);

export const wmsBinStatusEnum = pgEnum("wms_bin_status", [
  "empty",       // Bo'sh
  "partial",     // Qisman band
  "full",        // To'la
  "reserved",    // Band qilingan
  "blocked",     // Bloklangan / Ta'mirda
]);

export const wmsContainerTypeEnum = pgEnum("wms_container_type", [
  "pallet",      // Palet
  "box",         // Quti
  "roll",        // Rulon
  "drum",        // Bochka
  "bundle",      // Bog'lam
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
    finishedGoodId: uuid("finished_good_id").references(() => warehouseFinishedGoods.id, { onDelete: "set null" }),
    sourceWorkOrderId: varchar("source_work_order_id", { length: 128 }),
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
    tradingSaleId: varchar("trading_sale_id", { length: 128 }),
    manifestId: uuid("manifest_id").references(() => warehouseDispatchManifests.id, {
      onDelete: "set null",
    }),
    originSource: varchar("origin_source", { length: 64 }).default("WorkOrder").notNull(),
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
    finishedGoodId: uuid("finished_good_id"),
    tradingCatalogId: varchar("trading_catalog_id", { length: 128 }),
    accountCode: varchar("account_code", { length: 16 }).default("2810").notNull(),
    sourceWorkOrderId: varchar("source_work_order_id", { length: 64 }),
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
    allocationStatus: varchar("allocation_status", { length: 32 }).default("Dedicated").notNull(),
    receiptStatus: varchar("receipt_status", { length: 32 }).default("Received").notNull(),
    costPricePerUnit: numeric("cost_price_per_unit", { precision: 15, scale: 2 }).default("0").notNull(),
    totalStockValue: numeric("total_stock_value", { precision: 15, scale: 2 }).default("0").notNull(),
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


// ─── 8. Warehouse Dispatch Manifests (Yuk Marshruti / Reys Manifesti) ──────────

export const warehouseDispatchManifests = pgTable(
  "warehouse_dispatch_manifests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    manifestNumber: varchar("manifest_number", { length: 64 }).notNull(), // Masalan: "MNF-2026-001"
    manifestDate: timestamp("manifest_date", { withTimezone: true }).defaultNow().notNull(),
    vehiclePlate: varchar("vehicle_plate", { length: 64 }), // Masalan: "01 A 777 AA"
    vehicleModel: varchar("vehicle_model", { length: 128 }), // Masalan: "Isuzu 5t"
    driverName: varchar("driver_name", { length: 255 }),
    driverPhone: varchar("driver_phone", { length: 64 }),
    destinationRoute: text("destination_route"),
    status: warehouseDispatchManifestStatusEnum("status").default("Draft").notNull(),
    totalShipmentsCount: integer("total_shipments_count").default(0).notNull(),
    totalPackages: integer("total_packages").default(0).notNull(),
    totalWeightKg: numeric("total_weight_kg", { precision: 12, scale: 2 }).default("0").notNull(),
    departureTime: varchar("departure_time", { length: 32 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("manifests_company_number_uq").on(table.companyId, table.manifestNumber),
    index("manifests_company_date_idx").on(table.companyId, table.manifestDate),
    index("manifests_status_idx").on(table.companyId, table.status),
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
  wmsZones: many(wmsZones),
  wmsRacks: many(wmsRacks),
  wmsBins: many(wmsBins),
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


export const warehouseDispatchManifestsRelations = relations(warehouseDispatchManifests, ({ one, many }) => ({
  company: one(companies, {
    fields: [warehouseDispatchManifests.companyId],
    references: [companies.id],
  }),
  shipments: many(warehouseShipments),
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
  manifest: one(warehouseDispatchManifests, {
    fields: [warehouseShipments.manifestId],
    references: [warehouseDispatchManifests.id],
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

// ─── 9. WMS Zones (Ombor Sektorlari / Zonalar) ──────────────────────────────

export const wmsZones = pgTable(
  "wms_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 32 }).notNull(), // Masalan: "A", "B", "RECEIVING", "SHIPPING"
    name: varchar("name", { length: 255 }).notNull(), // Masalan: "A Sektor — Qog'oz va karton"
    type: wmsZoneTypeEnum("type").default("storage").notNull(),
    color: varchar("color", { length: 32 }).default("#3b82f6").notNull(),
    // 2D Canvas xaritadagi pozitsiya (santimetr yoki piksel nisbatida)
    x: doublePrecision("x").default(0).notNull(),
    y: doublePrecision("y").default(0).notNull(),
    width: doublePrecision("width").default(400).notNull(),
    height: doublePrecision("height").default(300).notNull(),
    rotation: doublePrecision("rotation").default(0).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wms_zones_warehouse_code_uq").on(table.warehouseId, table.code),
    index("wms_zones_warehouse_idx").on(table.warehouseId),
  ]
);

// ─── 10. WMS Racks & Elements (Stelajlar va Xarita Obyektlari) ────────────────

export const wmsRacks = pgTable(
  "wms_racks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id").references(() => wmsZones.id, { onDelete: "set null" }),
    code: varchar("code", { length: 32 }).notNull(), // Masalan: "R01", "R02", "GATE-1"
    name: varchar("name", { length: 255 }).notNull(), // Masalan: "Stelaj A-01"
    type: wmsRackTypeEnum("type").default("pallet").notNull(),
    // 2D Top-Down koordinatalar
    x: doublePrecision("x").default(100).notNull(),
    y: doublePrecision("y").default(100).notNull(),
    width: doublePrecision("width").default(240).notNull(), // Stelajning xaritadagi eni (masalan, 240px = 2.4m)
    depth: doublePrecision("depth").default(80).notNull(),  // Stelaj chuqurligi (masalan, 80px = 0.8m)
    rotation: doublePrecision("rotation").default(0).notNull(), // 0, 90, 180, 270
    // Qavatlar va kataklar matritsasi
    levelsCount: integer("levels_count").default(4).notNull(), // Qavatlar soni (vertikal)
    baysCount: integer("bays_count").default(6).notNull(),     // Har bir qavatdagi kataklar soni (gorizontal)
    maxWeightKg: numeric("max_weight_kg", { precision: 12, scale: 2 }).default("10000").notNull(),
    status: varchar("status", { length: 32 }).default("active").notNull(), // active, maintenance, full, blocked
    visualConfig: jsonb("visual_config"), // Qo'shimcha UI sozlamalari (rang, teglari, belgilari)
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wms_racks_warehouse_code_uq").on(table.warehouseId, table.code),
    index("wms_racks_warehouse_idx").on(table.warehouseId),
    index("wms_racks_zone_idx").on(table.zoneId),
  ]
);

// ─── 11. WMS Bins (Kataklar / Yacheykalar) ───────────────────────────────────

export const wmsBins = pgTable(
  "wms_bins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    rackId: uuid("rack_id")
      .notNull()
      .references(() => wmsRacks.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id").references(() => wmsZones.id, { onDelete: "set null" }),
    code: varchar("code", { length: 64 }).notNull(), // Unikal WMS manzil: "WH1-A-R01-L02-B04"
    barcode: varchar("barcode", { length: 64 }), // Shtrix/QR kod skan qilish uchun
    level: integer("level").notNull(), // Qavat raqami: 1, 2, 3...
    bay: integer("bay").notNull(),     // Ustun/katak raqami: 1, 2, 3...
    // Moslashuvchan kataklar: birlashtirish (merge) va o'lcham
    rowSpan: integer("row_span").default(1).notNull(),
    colSpan: integer("col_span").default(1).notNull(),
    widthCm: numeric("width_cm", { precision: 10, scale: 2 }).default("120").notNull(),
    heightCm: numeric("height_cm", { precision: 10, scale: 2 }).default("150").notNull(),
    depthCm: numeric("depth_cm", { precision: 10, scale: 2 }).default("100").notNull(),
    maxWeightKg: numeric("max_weight_kg", { precision: 10, scale: 2 }).default("1000").notNull(),
    currentWeightKg: numeric("current_weight_kg", { precision: 10, scale: 2 }).default("0").notNull(),
    occupancyPct: integer("occupancy_pct").default(0).notNull(), // 0 - 100%
    status: wmsBinStatusEnum("status").default("empty").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wms_bins_warehouse_code_uq").on(table.warehouseId, table.code),
    index("wms_bins_rack_idx").on(table.rackId),
    index("wms_bins_status_idx").on(table.status),
  ]
);

// ─── 12. WMS Bin Items (Katak Ichidagi Mahsulotlar & Konteynerlar) ─────────────

export const wmsBinItems = pgTable(
  "wms_bin_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouses.id, { onDelete: "cascade" }),
    rackId: uuid("rack_id")
      .notNull()
      .references(() => wmsRacks.id, { onDelete: "cascade" }),
    binId: uuid("bin_id")
      .notNull()
      .references(() => wmsBins.id, { onDelete: "cascade" }),
    // Mavjud zaxiralar bilan bog'lanish
    stockBalanceId: uuid("stock_balance_id").references(() => warehouseStockBalances.id, { onDelete: "set null" }),
    finishedGoodId: uuid("finished_good_id").references(() => warehouseFinishedGoods.id, { onDelete: "set null" }),
    itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
    // Mahsulot rekvizitlari
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    category: varchar("category", { length: 64 }).default("Paper & Board").notNull(),
    batchNumber: varchar("batch_number", { length: 64 }),
    workOrderId: varchar("work_order_id", { length: 128 }),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    reservedQty: numeric("reserved_qty", { precision: 15, scale: 3 }).default("0").notNull(),
    unit: varchar("unit", { length: 32 }).default("sheets").notNull(),
    weightKg: numeric("weight_kg", { precision: 10, scale: 2 }).default("0").notNull(),
    // 3-Rejim (Katak ichki 2D ko'rinishi) uchun konteyner parametrlari
    containerType: wmsContainerTypeEnum("container_type").default("pallet").notNull(),
    posX: doublePrecision("pos_x").default(10).notNull(),     // Katak ichidagi X siljish (px)
    posY: doublePrecision("pos_y").default(10).notNull(),     // Katak ichidagi Y siljish (px)
    widthPx: doublePrecision("width_px").default(80).notNull(),
    heightPx: doublePrecision("height_px").default(80).notNull(),
    color: varchar("color", { length: 32 }).default("#3b82f6"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("wms_bin_items_bin_idx").on(table.binId),
    index("wms_bin_items_sku_idx").on(table.sku),
    index("wms_bin_items_stock_balance_idx").on(table.stockBalanceId),
  ]
);

// ─── Relations for WMS ────────────────────────────────────────────────────────

export const wmsZonesRelations = relations(wmsZones, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [wmsZones.warehouseId],
    references: [warehouses.id],
  }),
  racks: many(wmsRacks),
  bins: many(wmsBins),
}));

export const wmsRacksRelations = relations(wmsRacks, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [wmsRacks.warehouseId],
    references: [warehouses.id],
  }),
  zone: one(wmsZones, {
    fields: [wmsRacks.zoneId],
    references: [wmsZones.id],
  }),
  bins: many(wmsBins),
  items: many(wmsBinItems),
}));

export const wmsBinsRelations = relations(wmsBins, ({ one, many }) => ({
  warehouse: one(warehouses, {
    fields: [wmsBins.warehouseId],
    references: [warehouses.id],
  }),
  rack: one(wmsRacks, {
    fields: [wmsBins.rackId],
    references: [wmsRacks.id],
  }),
  zone: one(wmsZones, {
    fields: [wmsBins.zoneId],
    references: [wmsZones.id],
  }),
  items: many(wmsBinItems),
}));

export const wmsBinItemsRelations = relations(wmsBinItems, ({ one }) => ({
  warehouse: one(warehouses, {
    fields: [wmsBinItems.warehouseId],
    references: [warehouses.id],
  }),
  rack: one(wmsRacks, {
    fields: [wmsBinItems.rackId],
    references: [wmsRacks.id],
  }),
  bin: one(wmsBins, {
    fields: [wmsBinItems.binId],
    references: [wmsBins.id],
  }),
  stockBalance: one(warehouseStockBalances, {
    fields: [wmsBinItems.stockBalanceId],
    references: [warehouseStockBalances.id],
  }),
  finishedGood: one(warehouseFinishedGoods, {
    fields: [wmsBinItems.finishedGoodId],
    references: [warehouseFinishedGoods.id],
  }),
}));
