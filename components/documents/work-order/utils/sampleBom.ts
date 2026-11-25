import type { BomItem } from "../../BomMaterialsGrid";
import type { WarehouseStockRecord } from "@/store/workspaceStore";
import type { WorkOrderFormData, WorkOrderSampleData } from "../types";
import { stockUnitPriceInOrderCurrency } from "./kashirovkaBom";

/** BOM row of the paper issued for the sample run; the mass-run paper row is separate. */
export const SAMPLE_PAPER_SOURCE = "sample:paper";

export function isSampleBomRow(item: Pick<BomItem, "autoSource">): boolean {
  return item.autoSource === SAMPLE_PAPER_SOURCE;
}

/**
 * Keeps one BOM row for the sample paper: the stock picked on the sample card with the
 * sheets issued for it. The row only exists while a sample is required and the paper is
 * a warehouse item, so the write-off never hits an unknown SKU. A row the user edited
 * (autoLocked) or deleted (dismissed) is left alone.
 */
export function syncSampleBomRow(
  bomItems: BomItem[],
  sample: Partial<WorkOrderSampleData>,
  form: Partial<WorkOrderFormData>,
  stockList: WarehouseStockRecord[]
): BomItem[] {
  const previous = bomItems.find(isSampleBomRow);
  if (previous?.autoLocked) return bomItems;
  const items = bomItems.filter((i) => !isSampleBomRow(i));
  if ((form.bomDismissedAutoSources || []).includes(SAMPLE_PAPER_SOURCE)) return items;

  const required = form.orderType === "Sample" || Boolean(sample.isRequired);
  const sheets = Math.max(0, Math.round(Number(sample.paperSheets) || 0));
  const key = (sample.paperStock || "").trim().toLowerCase();
  const ws = key ? stockList.find((s) => s.name.toLowerCase() === key || s.sku.toLowerCase() === key) : undefined;
  if (!required || !sheets || !ws) return items;

  const price = stockUnitPriceInOrderCurrency(ws, form);
  const sameStock = previous?.id === ws.sku;
  const unitPrice = price.unitPrice || (sameStock ? previous!.unitPrice : 0) || 0;
  const actualQty =
    sameStock && previous!.actualQty > 0 && previous!.actualQty !== previous!.planQty ? previous!.actualQty : sheets;
  const row: BomItem = {
    ...(sameStock ? previous! : {}),
    id: ws.sku,
    name: ws.name,
    spec: [ws.grammage ? `${ws.grammage} g/m²` : "", ws.sheetFormat || ""].filter(Boolean).join(", "),
    category: ws.category,
    sheetFormat: ws.sheetFormat || undefined,
    grammage: ws.grammage,
    planQty: sheets,
    actualQty,
    wasteQty: Math.max(0, actualQty - sheets),
    qty: actualQty,
    unit: ws.unit || "Sheets",
    unitPrice,
    ...(price.originalCurrency
      ? { originalUnitPrice: price.originalUnitPrice, originalCurrency: price.originalCurrency }
      : {}),
    totalPrice: Number((actualQty * unitPrice).toFixed(2)),
    supplier: ws.supplier || "Ombor",
    availability: ws.status === "Critical" ? "Low Stock" : ((ws.status as BomItem["availability"]) || "In Stock"),
    issueType: "standard",
    faultParty: "none",
    notes: "Namuna",
    warehouseLocation: ws.location || "",
    warehouseStockLevel: ws.stockLevel,
    warehouseAvailable: ws.available,
    sourceType: "warehouse",
    autoSource: SAMPLE_PAPER_SOURCE,
  };
  // Right after the mass-run paper row
  const mainPaperIdx = items.findIndex(
    (i) => !i.autoSource && (i.category === "Paper & Board" || i.category === "Roll & Label" || i.category === "Offcuts & Scraps")
  );
  const next = [...items];
  next.splice(mainPaperIdx >= 0 ? mainPaperIdx + 1 : 0, 0, row);
  return next;
}
