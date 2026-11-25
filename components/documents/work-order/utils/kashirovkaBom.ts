import type { BomItem } from "../../BomMaterialsGrid";
import type { WarehouseStockRecord } from "@/store/workspaceStore";
import {
  KASHIROVKA_LAYER_LABELS,
  type WorkOrderFormData,
  kashirovkaLayerInks,
  resolveKashirovkaGlueGsm,
} from "../types";

const KASHIROVKA_AUTO_PREFIX = "kashirovka:";

export function stockUnitPriceInOrderCurrency(ws: WarehouseStockRecord, form: Partial<WorkOrderFormData>) {
  const orderCur = (form.currency || "UZS").toUpperCase();
  const fx = Number(form.exchangeRate) || 12850;
  const stockCur: "USD" | "UZS" =
    (ws as any).currency || ((ws as any).unitPriceUzs && !ws.unitPriceUsd ? "UZS" : "USD");
  const orig = Number(
    stockCur === "UZS"
      ? (ws as any).unitPriceUzs || (ws as any).unitPrice || 0
      : ws.unitPriceUsd || (ws as any).unitPrice || 0
  );
  if (!(orig > 0)) return { unitPrice: 0 };
  const unitPrice =
    stockCur === "USD" && orderCur === "UZS"
      ? Number((orig * fx).toFixed(2))
      : stockCur === "UZS" && orderCur === "USD"
      ? Number((orig / fx).toFixed(4))
      : orig;
  return { unitPrice, originalUnitPrice: orig, originalCurrency: stockCur };
}

/**
 * Keeps one BOM row per mounted kashirovka layer and one for the glue. The face liner is
 * the order's main paper row. A printed back liner on a 1-CTP (half sheet) layout shares
 * the press sheet with the face, so it adds no paper and the glued area is half the sheets.
 * Rows are only added for materials found in the warehouse, so a write-off never hits an
 * unknown SKU. Rows the user edited (autoLocked) are left as they are.
 */
export function syncKashirovkaBomRows(
  bomItems: BomItem[],
  form: Partial<WorkOrderFormData>,
  stockList: WarehouseStockRecord[],
  parentSheets: number
): BomItem[] {
  const isAuto = (i: BomItem) => Boolean(i.autoSource?.startsWith(KASHIROVKA_AUTO_PREFIX));
  const previous = new Map(bomItems.filter(isAuto).map((i) => [i.autoSource as string, i]));
  let items = bomItems.filter((i) => !isAuto(i) || i.autoLocked);

  const mode = form.kashirovkaMode;
  const layers = form.kashirovkaLayers || [];
  if (!mode || mode === "none" || layers.length < 2 || !(parentSheets > 0) || !(Number(form.quantity) > 0)) {
    return items;
  }

  const findStock = (name?: string) => {
    const key = (name || "").trim().toLowerCase();
    if (!key) return undefined;
    return stockList.find((s) => s.name.toLowerCase() === key || s.sku.toLowerCase() === key);
  };
  // Locked rows stay as the user left them; dismissed ones were deleted by the user.
  const lockedKeys = new Set([
    ...items.filter(isAuto).map((i) => i.autoSource as string),
    ...(form.bomDismissedAutoSources || []),
  ]);

  const buildRow = (
    key: string,
    ws: WarehouseStockRecord,
    planQty: number,
    fallbackUnit: string,
    note: string,
    extra: Partial<BomItem> = {}
  ): BomItem => {
    const ex = previous.get(key);
    const sameStock = Boolean(ex && ex.id === ws.sku);
    const price = stockUnitPriceInOrderCurrency(ws, form);
    const unitPrice = price.unitPrice || (sameStock ? ex!.unitPrice : 0) || 0;
    const actualQty =
      sameStock && ex!.actualQty > 0 && ex!.actualQty !== ex!.planQty ? ex!.actualQty : planQty;
    const img =
      ws.imageUrl && typeof ws.imageUrl === "string" && !ws.imageUrl.startsWith("data:image/svg+xml")
        ? ws.imageUrl.trim()
        : undefined;
    return {
      ...(sameStock ? ex! : {}),
      id: ws.sku,
      name: ws.name,
      spec: (ws as any).spec || ws.category || "",
      category: ws.category,
      planQty,
      actualQty,
      wasteQty: Math.max(0, actualQty - planQty),
      qty: actualQty,
      unit: ws.unit || fallbackUnit,
      unitPrice,
      ...(price.originalCurrency
        ? { originalUnitPrice: price.originalUnitPrice, originalCurrency: price.originalCurrency }
        : {}),
      totalPrice: Number((actualQty * unitPrice).toFixed(2)),
      supplier: ws.supplier || "Ombor",
      availability: ws.status === "Critical" ? "Low Stock" : ((ws.status as BomItem["availability"]) || "In Stock"),
      issueType: "standard",
      faultParty: "none",
      notes: note,
      warehouseLocation: ws.location || "",
      warehouseStockLevel: ws.stockLevel,
      warehouseAvailable: ws.available,
      sourceType: "warehouse",
      imageUrl: img,
      autoSource: key,
      ...extra,
    };
  };

  const strategy = form.kashirovkaStrategy || "split_half_sheet";
  const bottom = layers.find((l) => l.role === "bottom_liner");
  const backSharesSheet = strategy === "split_half_sheet" && kashirovkaLayerInks(bottom?.colors) > 0;
  // Kashirovka make-ready ("Priladka") sheets are mounted too, so they need backing paper and glue.
  const makeReadySheets = Math.max(0, Math.round(Number(form.kashirovkaMakeReadySheets) || 0));
  const mountedSheets = (backSharesSheet ? Math.ceil(parentSheets / 2) : parentSheets) + makeReadySheets;

  const layerRows: BomItem[] = [];
  for (const layer of layers) {
    if (layer.role === "top_liner") continue;
    if (layer.role === "bottom_liner" && backSharesSheet) continue;
    const key = `${KASHIROVKA_AUTO_PREFIX}${layer.role}`;
    if (lockedKeys.has(key)) continue;
    const ws = findStock(layer.paperStock || form.paperStock);
    if (!ws) continue;
    const gsm = layer.grammage || ws.grammage;
    layerRows.push(
      buildRow(key, ws, mountedSheets, "Sheets", `Kashirovka · ${KASHIROVKA_LAYER_LABELS[layer.role]}`, {
        spec: [gsm ? `${gsm} g/m²` : "", ws.sheetFormat || ""].filter(Boolean).join(", "),
        sheetFormat: ws.sheetFormat || undefined,
        grammage: gsm,
      })
    );
  }
  if (layerRows.length > 0) {
    const mainPaperIdx = items.findIndex(
      (i) => !i.autoSource && (i.category === "Paper & Board" || i.category === "Offcuts & Scraps")
    );
    items = [...items];
    items.splice(mainPaperIdx >= 0 ? mainPaperIdx + 1 : 0, 0, ...layerRows);
  }

  const glueKey = `${KASHIROVKA_AUTO_PREFIX}glue`;
  if (!lockedKeys.has(glueKey)) {
    // The glue is the one picked on the Kashirovka card; nothing is guessed from the catalogue.
    const glueSku = (form.kashirovkaGlueStockSku || "").trim().toLowerCase();
    const glue = glueSku ? stockList.find((s) => s.sku.toLowerCase() === glueSku) : undefined;
    const sheetW = Number(form.parentSheetW) || 0;
    const sheetH = Number(form.parentSheetH) || 0;
    if (glue && sheetW > 0 && sheetH > 0) {
      const bonds = layers.length - 1;
      const gsm = resolveKashirovkaGlueGsm(form.kashirovkaGlueGsm);
      const glueGrams = ((sheetW * sheetH) / 1e6) * mountedSheets * bonds * gsm;
      const inGrams = /^(g|gr|гр|г)$/i.test((glue.unit || "").trim());
      const glueQty = Number((inGrams ? glueGrams : glueGrams / 1000).toFixed(2));
      if (glueQty > 0) {
        items = [...items, buildRow(glueKey, glue, glueQty, "kg", "Kashirovka · Yelim")];
      }
    }
  }

  return items;
}
