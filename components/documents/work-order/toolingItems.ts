// Ish buyrug'i uchun boshlang'ich jihoz (qolip/klishe) ro'yxati. "use client" siz: server ham ishlatadi.
import type { ToolingSide, WorkOrderFormData, WorkOrderToolingItem } from "./types";

/** Delivery cost that counts toward the item's landed cost (zero when it is included in the price). */
export function toolingDeliveryCost(item: Pick<WorkOrderToolingItem, "deliveryMethod" | "deliveryCost">): number {
  if (!item.deliveryMethod || item.deliveryMethod === "included") return 0;
  return Number(item.deliveryCost) || 0;
}

/** Landed cost of a tooling item: purchase price (fact over plan) plus delivery. */
export function toolingItemTotalCost(
  item: Pick<WorkOrderToolingItem, "actualCost" | "estimatedCost" | "deliveryMethod" | "deliveryCost">
): number {
  const base = Number(item.actualCost !== undefined ? item.actualCost : item.estimatedCost || 0) || 0;
  return base + toolingDeliveryCost(item);
}

/** The supplier-order fields needed to tie an order (and its delivery) to a work-order tooling item. */
export interface ToolingOrderLink {
  /** Set on orders placed for one item; older orders are matched by PO number, name or kind. */
  toolingItemId?: string | null;
  orderNo?: string;
  orderType?: string;
  title?: string;
  status?: string;
  supplierId?: string;
  supplierName?: string;
  deliveryMethod?: WorkOrderToolingItem["deliveryMethod"];
  deliveryCost?: number;
}

const SIDE_NAME: Record<ToolingSide, string> = { front: "Oldi", back: "Orqa", set: "Komplekt" };

/** Plate sets a montaj needs: one per printed side, or one shared set. */
export interface MontajCtpSide {
  side: ToolingSide;
  plates: number;
}

/**
 * Production CTP items after a montaj is applied: one item per side (Oldi, Orqa) or one Komplekt,
 * each carrying the montaj file. An item already ordered is never changed; such items are returned
 * in `locked` so the user can be told. Sample plates and other tooling are left as they are.
 */
export function applyMontajCtpItems(
  current: WorkOrderToolingItem[],
  sides: MontajCtpSide[],
  opts: {
    orderLabel: string;
    specDetails: string;
    unitCost: number;
    currency: string;
    files: Pick<WorkOrderToolingItem, "fileUrl" | "fileName" | "imageUrl">;
  }
): { items: WorkOrderToolingItem[]; locked: WorkOrderToolingItem[] } {
  const isProductionCtp = (t: WorkOrderToolingItem) => t.category === "ctp_plates" && t.phase !== "sample";
  const ordered = (t: WorkOrderToolingItem) => !!t.purchaseOrderNo;
  const wanted = sides.filter((s) => s.plates > 0);
  const locked: WorkOrderToolingItem[] = [];

  // An older single CTP item (no side) that is already ordered still stands for the whole set
  const legacyOrdered = current.find((t) => isProductionCtp(t) && !t.side && ordered(t));
  if (legacyOrdered) return { items: current, locked: [legacyOrdered] };

  const next: WorkOrderToolingItem[] = [];
  for (const t of current) {
    if (!isProductionCtp(t)) {
      next.push(t);
      continue;
    }
    if (!t.side) continue; // replaced by the side items below
    if (ordered(t)) {
      next.push(t);
      if (wanted.some((w) => w.side === t.side)) locked.push(t);
      continue;
    }
    if (wanted.some((w) => w.side === t.side)) next.push(t); // updated below
  }

  const now = Date.now();
  wanted.forEach((w, i) => {
    const idx = next.findIndex((t) => isProductionCtp(t) && t.side === w.side);
    if (idx >= 0 && ordered(next[idx])) return;
    const fields = {
      ...opts.files,
      name: `${opts.orderLabel ? opts.orderLabel + " " : ""}CTP ${SIDE_NAME[w.side]}`,
      quantity: w.plates,
      specDetails: opts.specDetails,
      estimatedCost: opts.unitCost * w.plates,
    };
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...fields };
    } else {
      next.unshift({
        id: `TL-CTP-${w.side}-${now + i}`,
        category: "ctp_plates",
        side: w.side,
        phase: "production",
        unit: "dona",
        currency: opts.currency,
        status: "Draft",
        createdAt: new Date(now).toISOString(),
        ...fields,
      });
    }
  });
  // Oldi before Orqa
  const rank = (t: WorkOrderToolingItem) => (t.side === "front" ? 0 : t.side === "back" ? 1 : t.side === "set" ? 0 : 2);
  const ctp = next.filter(isProductionCtp).sort((a, b) => rank(a) - rank(b));
  return { items: [...ctp, ...next.filter((t) => !isProductionCtp(t))], locked };
}

/** Same rule the Tooling & CTP grid uses for status sync: item id, else PO number, else name, else category. */
export function toolingItemMatchesOrder(t: WorkOrderToolingItem, order: ToolingOrderLink): boolean {
  if (order.toolingItemId) return t.id === order.toolingItemId;
  if (t.purchaseOrderNo && order.orderNo && t.purchaseOrderNo === order.orderNo) return true;
  if (t.name && order.title && t.name.toLowerCase() === order.title.toLowerCase()) return true;
  return (
    (order.orderType === "ctp_plates" && (t.category === "ctp_plates" || t.category === "flexo_polymer")) ||
    (order.orderType === "die_tooling" && t.category === "die_cutting") ||
    (order.orderType === "cliche" && (t.category === "foil_cliche" || t.category === "emboss_cliche"))
  );
}

/** The one item an order is for: its linked item, else the PO's own item, else the first unclaimed match. */
export function findDeliveryTarget(
  items: WorkOrderToolingItem[],
  order: ToolingOrderLink,
  claimed: ReadonlySet<string> = new Set()
): WorkOrderToolingItem | undefined {
  if (order.toolingItemId) return items.find((t) => t.id === order.toolingItemId);
  return (
    items.find((t) => order.orderNo && t.purchaseOrderNo === order.orderNo) ||
    items.find((t) => !claimed.has(t.id) && toolingItemMatchesOrder(t, order)) ||
    items.find((t) => toolingItemMatchesOrder(t, order))
  );
}

// Tooling item lifecycle order; a supplier order may move an item forward, never back (e.g. Mounted stays Mounted)
const TOOLING_STATUS_RANK: Record<string, number> = {
  Draft: 0,
  Ordered: 1,
  In_Production: 2,
  Ready: 3,
  Delivered: 4,
  Mounted: 5,
};

const SUPPLIER_TO_TOOLING_STATUS: Record<string, WorkOrderToolingItem["status"]> = {
  Ordered: "Ordered",
  In_Production: "In_Production",
  Ready: "Ready",
  Delivered: "Delivered",
};

/**
 * Supplier orders (Tooling & CTP) are the source of truth for what was ordered from whom, how far it got
 * and what its delivery cost: fold them into the work order's tooling items. Cancelled and draft orders
 * are ignored; several orders landing on one item have their delivery summed.
 */
export function applySupplierOrders(items: WorkOrderToolingItem[], orders: ToolingOrderLink[]): WorkOrderToolingItem[] {
  if (!items.length || !orders.length) return items;
  const patches = new Map<string, Partial<WorkOrderToolingItem>>();
  // Items with an order placed for them by id take only those orders; older orders match the rest.
  const linkedIds = new Set(orders.map((o) => o.toolingItemId).filter((id): id is string => !!id));
  const claimed = new Set<string>(linkedIds);

  for (const order of orders) {
    const nextStatus = order.status ? SUPPLIER_TO_TOOLING_STATUS[order.status] : undefined;
    if (!nextStatus) continue;
    const target = order.toolingItemId
      ? items.find((t) => t.id === order.toolingItemId)
      : findDeliveryTarget(items.filter((t) => !linkedIds.has(t.id)), order, claimed);
    if (!target) continue;
    claimed.add(target.id);

    const prev = patches.get(target.id) || {};
    const current = (prev.status || target.status) as string;
    // An item's own orders come oldest first: the latest one (a remake replaces the original) sets its
    // status; only a mounted plate stays mounted. Older unlinked orders may only move an item forward.
    const status: WorkOrderToolingItem["status"] = order.toolingItemId
      ? nextStatus === "Delivered" && target.status === "Mounted"
        ? "Mounted"
        : nextStatus
      : (TOOLING_STATUS_RANK[nextStatus] ?? 0) > (TOOLING_STATUS_RANK[current] ?? 0)
        ? nextStatus
        : (current as WorkOrderToolingItem["status"]);
    const patch: Partial<WorkOrderToolingItem> = {
      ...prev,
      purchaseOrderNo: order.orderNo || target.purchaseOrderNo,
      supplierId: order.supplierId || target.supplierId,
      supplierName: order.supplierName || target.supplierName,
      status,
    };
    if (order.deliveryMethod) {
      const cost = order.deliveryMethod !== "included" ? Number(order.deliveryCost) || 0 : 0;
      const prevCost = prev.deliveryMethod ? Number(prev.deliveryCost) || 0 : 0;
      patch.deliveryMethod =
        prev.deliveryMethod && prev.deliveryMethod !== "included" ? prev.deliveryMethod : order.deliveryMethod;
      patch.deliveryCost = prevCost + cost;
    }
    patches.set(target.id, patch);
  }

  if (patches.size === 0) return items;
  return items.map((t) => {
    const p = patches.get(t.id);
    return p ? { ...t, ...p } : t;
  });
}

const SUPPLIER_SOURCED_FIELDS = [
  "purchaseOrderNo",
  "supplierId",
  "supplierName",
  "status",
  "deliveryMethod",
  "deliveryCost",
] as const;

/**
 * An open work order keeps its own copy of the tooling list. Supplier-order facts (PO, supplier,
 * progress, delivery) arrive with the refreshed server copy: copy just those fields onto matching
 * items. Returns the same array when nothing changed, so callers can skip a state update.
 */
export function mergeSupplierSourcedFields(
  local: WorkOrderToolingItem[],
  server: WorkOrderToolingItem[]
): WorkOrderToolingItem[] {
  if (!local.length || !server.length) return local;
  const byId = new Map(server.map((t) => [t.id, t]));
  let changed = false;
  const next = local.map((t) => {
    const src = byId.get(t.id);
    if (!src) return t;
    const patch: Partial<WorkOrderToolingItem> = {};
    for (const f of SUPPLIER_SOURCED_FIELDS) {
      if (src[f] === undefined || src[f] === t[f]) continue;
      // Status only moves forward, unless a new order (a remake) took over the item.
      const sameOrder = !src.purchaseOrderNo || src.purchaseOrderNo === t.purchaseOrderNo;
      if (f === "status" && sameOrder && (TOOLING_STATUS_RANK[src.status] ?? 0) <= (TOOLING_STATUS_RANK[t.status] ?? 0)) continue;
      (patch as Record<string, unknown>)[f] = src[f];
    }
    if (Object.keys(patch).length === 0) return t;
    changed = true;
    return { ...t, ...patch };
  });
  return changed ? next : local;
}

export function getInitialToolingItems(data: Partial<WorkOrderFormData>, docNo: string): WorkOrderToolingItem[] {
  const hasAppliedImposition = Boolean((data as any).plannedSheets && Number((data as any).plannedSheets) > 0);

  if (data.toolingItems && data.toolingItems.length > 0) {
    // Filter out legacy auto-generated placeholder CTP item if imposition has not been applied yet
    if (!hasAppliedImposition) {
      return data.toolingItems.filter(
        (item) =>
          !(
            item.category === "ctp_plates" &&
            item.status === "Draft" &&
            !item.purchaseOrderNo &&
            item.specDetails.includes("(CMYK 4 rang)")
          )
      );
    }
    return data.toolingItems;
  }

  const items: WorkOrderToolingItem[] = [];
  const dept = data.department || "Offset";
  const isUsd = (data.currency || "UZS").toUpperCase() === "USD";

  // 1. CTP / Polimer formalar:
  // Offset uchun CTP formalar faqat Imposition ("Montaj / Hisob") bo'limida,
  // Flexo uchun polimer formalar esa faqat FlexoCalcTab da yakuniy fayl biriktirilgandan keyin
  // haqiqiy ranglar soni bilan shakllanadi.

  // 2. Kesish shtampi (agar shaklli kesim yoki die-cut bo'lsa)
  if (
    data.shapeType === "custom_die" ||
    data.shapeType === "carton_box" ||
    data.shapeType === "circle" ||
    data.shapeType === "oval" ||
    data.cornerType === "Die-cut" ||
    data.selectedToolingId
  ) {
    items.push({
      id: `TL-DIE-${Date.now() + 1}`,
      category: "die_cutting",
      name: data.selectedToolingName || `${data.product || "Mahsulot"} Kesish Shtampi (Flatbed Die)`,
      specDetails: `Razmer: ${data.width || 700}×${data.height || 1000} mm, 23.8mm pichoq`,
      quantity: 1,
      unit: "dona",
      estimatedCost: data.toolingProcurementCost || (isUsd ? 65 : 800000),
      currency: data.currency || "UZS",
      status: data.selectedToolingId ? "Ready" : "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  // 3. Folga klishesi
  if (data.embellishment?.toLowerCase().includes("foil") || data.coating?.toLowerCase().includes("foil")) {
    items.push({
      id: `TL-FOIL-${Date.now() + 2}`,
      category: "foil_cliche",
      name: `${data.product || "Mahsulot"} Zarhal (Hot Foil) Klishesi`,
      specDetails: "Material: Latun (Jez 3mm CNC gravirovka)",
      quantity: 1,
      unit: "dona",
      estimatedCost: isUsd ? 30 : 350000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  // 4. Kongrev klishesi
  if (data.embellishment?.toLowerCase().includes("emboss") || data.coating?.toLowerCase().includes("emboss")) {
    items.push({
      id: `TL-EMB-${Date.now() + 3}`,
      category: "emboss_cliche",
      name: `${data.product || "Mahsulot"} Kongrev (Embossing) Klishesi`,
      specDetails: "Material: Magniy 4mm (Matritsa + Patriysa)",
      quantity: 1,
      unit: "dona",
      estimatedCost: isUsd ? 25 : 300000,
      currency: data.currency || "UZS",
      status: "Draft",
      createdAt: new Date().toISOString(),
    });
  }

  return items;
}
