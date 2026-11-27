// Defitsit hisoblari: reyestr gridlari va sidebar badge'lari bir xil natija berishi uchun umumiy.
// Server va brauzerda ishlaydi — faqat sof funksiyalar.
import type { ProductionQueueItem, WarehouseStockRecord } from "@/store/workspaceStore";
import type { ToolingOrderRecord } from "@/lib/server/supplierService";
import type { ToolingSide, WorkOrderToolingItem } from "@/components/documents/work-order/types";
import { getInitialToolingItems, toolingItemMatchesOrder } from "@/components/documents/work-order/toolingItems";

type ToolingOrderLike = {
  workOrderNo?: string | null;
  toolingItemId?: string | null;
  orderNo?: string | null;
  title?: string | null;
  orderType: ToolingOrderRecord["orderType"];
  status: string;
};

export interface MaterialDeficitRow {
  id: string;
  workOrderId: string;
  customer: string;
  product: string;
  materialSku: string;
  materialName: string;
  category: string;
  sheetFormat: string;
  grammage: number;
  requiredQty: number;
  availableQty: number;
  deficitQty: number;
  unit: string;
  deadline?: string;
  priority?: string;
  status: "Deficit";
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function isClientMaterial(m: any): boolean {
  return m?.acquisitionSource === "client" || m?.sourceType === "client" || norm(m?.supplier).includes("mijoz");
}

function isProcurementMaterial(m: any): boolean {
  return m?.acquisitionSource === "procurement" || m?.sourceType === "procurement" || m?.availability === "On Order";
}

/** Katalogdagi pozitsiya: avval SKU, so'ng to'liq nom bo'yicha (sarf bilan bir xil qoida). */
function matchStock(m: any, stock: WarehouseStockRecord[]): WarehouseStockRecord | undefined {
  const sku = norm(m?.sku || m?.id);
  const name = norm(m?.name);
  return (
    (sku ? stock.find((s) => norm(s.sku) === sku) : undefined) ||
    (name ? stock.find((s) => norm(s.name) === name) : undefined)
  );
}

function isMaterialsConsumed(q: ProductionQueueItem): boolean {
  const any = q as any;
  return !!(any.materialsConsumed || any.dimensions?.materialsConsumed || any.materialIssueDocNo);
}

/**
 * Ishdagi buyurtmalar BOM'idan xomashyo ehtiyoji ("Requirements" reyestri).
 * - "Xaridga" qatorlari: katalogda yo'q bo'lsa to'liq miqdori, bor bo'lsa (kirim qilingan) qoldiqdan oshgan qismi.
 * - "Ombordan" qatorlari: katalogdagi bo'sh qoldiqdan oshgan qismi. Qoldiq buyurtmalar
 *   orasida muddat tartibida taqsimlanadi, bir qoldiq ikki marta hisoblanmaydi.
 * - Mijoz xomashyosi, yakunlangan/bekor qilingan va xomashyosi sarflangan buyurtmalar o'tkazib yuboriladi.
 */
export function computeMaterialDeficits(
  queue: ProductionQueueItem[],
  stock: WarehouseStockRecord[]
): MaterialDeficitRow[] {
  const defs: MaterialDeficitRow[] = [];
  const remaining = new Map<string, number>();
  const remainingOf = (s: WarehouseStockRecord) =>
    remaining.has(s.sku) ? remaining.get(s.sku)! : Math.max(0, Number(s.available) || 0);

  const active = queue
    .filter((q) => q.stage !== "Completed" && q.status !== "Cancelled" && !isMaterialsConsumed(q))
    .sort((a, b) => String(a.deadline || "9999").localeCompare(String(b.deadline || "9999")));

  active.forEach((q) => {
    const materials = Array.isArray(q.materials) ? q.materials : [];
    materials.forEach((m: any, idx: number) => {
      if (!m || isClientMaterial(m)) return;
      const required = Number(m.actualQty ?? m.planQty ?? m.qty) || 0;
      if (required <= 0) return;

      const matched = matchStock(m, stock);
      const procurement = isProcurementMaterial(m);
      const avail = matched ? remainingOf(matched) : 0;

      // Katalogda topilmagan ombor qatori — ehtiyojni aniqlab bo'lmaydi.
      // Xarid qatori esa topilmasa ham to'liq miqdori bilan ehtiyoj.
      if (!matched && !procurement) return;

      // Xarid qilingan xomashyo kirim qilingach omborda paydo bo'ladi va ehtiyojni yopadi
      let deficit = required;
      if (matched) {
        const used = Math.min(avail, required);
        remaining.set(matched.sku, avail - used);
        deficit = required - used;
      }
      if (deficit <= 0) return;

      defs.push({
        id: `DEF-${q.id}-${idx}`,
        workOrderId: q.id,
        customer: q.customer,
        product: q.product,
        materialSku: matched?.sku || m.sku || "",
        materialName: m.name || matched?.name || "",
        category: m.category || matched?.category || "",
        sheetFormat: m.sheetFormat || matched?.sheetFormat || "",
        grammage: Number(m.grammage ?? matched?.grammage) || 0,
        requiredQty: required,
        availableQty: avail,
        deficitQty: deficit,
        unit: m.unit || matched?.unit || "",
        deadline: q.deadline,
        priority: q.priority,
        status: "Deficit",
      });
    });
  });
  return defs;
}

export interface ToolingDeficitRow {
  id: string;
  workOrderId: string;
  /** The work order's tooling item; an order placed from this row is linked to it. */
  toolingItemId: string;
  item: WorkOrderToolingItem;
  side?: ToolingSide;
  phase?: WorkOrderToolingItem["phase"];
  customer: string;
  product: string;
  neededTooling: string;
  specDetails?: string;
  quantity: number;
  unit: string;
  toolingCategory: ToolingOrderRecord["orderType"];
  deadline?: string;
  status: "Deficit";
  estimatedCost?: number;
  currency?: string;
  fileUrl?: string;
  fileName?: string;
  imageUrl?: string;
  /** Row sent without the item's embedded files; load the work order's item before ordering it. */
  listPartial?: boolean;
}

/** Supplier order kind that procures a tooling item. */
export function toolingOrderTypeOf(item: WorkOrderToolingItem): ToolingOrderRecord["orderType"] {
  if (item.category === "die_cutting") return "die_tooling";
  if (item.category === "foil_cliche" || item.category === "emboss_cliche") return "cliche";
  if (item.category === "varnish_plate") return "outsourcing";
  return "ctp_plates";
}

/** Buyurtmalarda kerak, lekin ta'minotchiga hali buyurtma berilmagan qolip/CTP/klishelar. */
export function computeToolingDeficits(
  queue: ProductionQueueItem[],
  orders: ToolingOrderLike[]
): ToolingDeficitRow[] {
  const list: ToolingDeficitRow[] = [];

  queue.forEach((q) => {
    if (q.stage === "Completed") return;
    const woNo = (q.id || q.docNo || "").trim();

    const items: WorkOrderToolingItem[] =
      Array.isArray(q.toolingItems) && q.toolingItems.length > 0
        ? q.toolingItems
        : getInitialToolingItems(q as any, woNo);

    // Each supplier order covers one item: the item it was placed for, or for older orders its PO
    // number, else same name, else the first unclaimed item of its kind.
    const woOrders = orders.filter(
      (o) => !!o.workOrderNo && o.workOrderNo.trim().toLowerCase() === woNo.toLowerCase() && o.status !== "Cancelled"
    );
    const orderedIds = new Set<string>(woOrders.map((o) => o.toolingItemId).filter((id): id is string => !!id));
    woOrders
      .filter((o) => !o.toolingItemId)
      .forEach((o) => {
        const link = { orderNo: o.orderNo || undefined, title: o.title || undefined, orderType: o.orderType };
        const open = items.filter((t) => !orderedIds.has(t.id));
        const target =
          (link.orderNo ? open.find((t) => t.purchaseOrderNo === link.orderNo) : undefined) ||
          (link.title ? open.find((t) => norm(t.name) === norm(link.title)) : undefined) ||
          open.find((t) => toolingItemMatchesOrder(t, link)) ||
          open.find((t) => toolingOrderTypeOf(t) === o.orderType);
        if (target) orderedIds.add(target.id);
      });

    items.forEach((item) => {
      if (item.status === "Ready" || item.status === "Delivered" || item.status === "Mounted") return;

      if (orderedIds.has(item.id)) return;
      const orderType = toolingOrderTypeOf(item);

      list.push({
        id: `DEF-${q.id}-${item.id || item.category}`,
        workOrderId: woNo,
        toolingItemId: item.id,
        item,
        side: item.side,
        phase: item.phase,
        customer: q.customer || "—",
        product: q.product || "Mahsulot",
        neededTooling: item.name,
        specDetails: item.specDetails,
        quantity: item.quantity || 1,
        unit: item.unit || "dona",
        toolingCategory: orderType,
        deadline: q.deadline,
        status: "Deficit",
        estimatedCost: item.estimatedCost,
        currency: item.currency || q.currency || "UZS",
        fileUrl: item.fileUrl || undefined,
        fileName: item.fileName || undefined,
        imageUrl:
          item.imageUrl ||
          q.photoUrl ||
          (Array.isArray(q.photoUrls) && q.photoUrls.length > 0 ? q.photoUrls[0] : undefined),
      });
    });
  });

  return list;
}
