// ─── PrintGoo ERP Modular Database Schema Registry ────────────────────────────
// Ma'lumotlar bazasi sxemalari bosqichma-bosqich (modulma-modul) ulanadi:
// [x] 1-Bosqich: Core (Companies, Branches, Audit Logs)
// [x] 2-Bosqich: Master Data (Units of Measure, Items & Materials, Flexo Machines, Cylinders, Dies, Pantone)
// [ ] 3-Bosqich: Prepress Files, Color Proofs & Work Orders
// [x] 4-Bosqich: 1C Accumulation Registers (Warehouse Stock & Finance Settlements)

export * from "./core";
export * from "./master";
export * from "./printing";
export * from "./hr";
export * from "./crm";
export * from "./production";
export * from "./warehouse";
export * from "./telegram";
export * from "./finance";
export * from "./trading";
export * from "./users";
export * from "./notifications";
