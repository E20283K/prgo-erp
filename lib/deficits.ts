// Defitsit hisoblari: reyestr gridlari va sidebar badge'lari bir xil natija berishi uchun umumiy.
// Server va brauzerda ishlaydi — faqat sof funksiyalar.
import type { ProductionQueueItem, WarehouseStockRecord } from "@/store/workspaceStore";
import type { ToolingOrderRecord } from "@/lib/server/supplierService";
import type { WorkOrderToolingItem } from "@/components/documents/work-order/types";
import { getInitialToolingItems } from "@/components/documents/work-order/toolingItems";

type ToolingOrderLike = {
  workOrderNo?: string | null;
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

/** Ishdagi buyurtmalar uchun xomashyo yetishmovchiligi ("Requirements" reyestri). */
export function computeMaterialDeficits(
  queue: ProductionQueueItem[],
  stock: WarehouseStockRecord[]
): MaterialDeficitRow[] {
  const defs: MaterialDeficitRow[] = [];
  queue.forEach((q) => {
    if (q.stage === "Completed") return;
    const product = (q.product || "").toLowerCase();

    const matchedStock =
      stock.find((s) => {
        const name = (s.name || "").toLowerCase();
        return name.includes(product) || product.includes(name);
      }) || stock.find((s) => s.category === "Paper & Board");

    const neededQty = q.plannedSheets || q.quantity || 1000;
    const avail = matchedStock?.available || 0;
    const deficit = Math.max(0, neededQty - avail);
    if (deficit <= 0) return;

    defs.push({
      id: `DEF-${q.id}`,
      workOrderId: q.id,
      customer: q.customer,
      product: q.product,
      materialSku: matchedStock?.sku || `PAP-${q.id.replace(/\D/g, "").slice(-3) || "REQ"}`,
      materialName: matchedStock?.name || `${q.product} Xomashyosi`,
      category: matchedStock?.category || "Paper & Board",
      sheetFormat: matchedStock?.sheetFormat || "700×1000",
      grammage: matchedStock?.grammage || 250,
      requiredQty: neededQty,
      availableQty: avail,
      deficitQty: deficit,
      unit: matchedStock?.unit || q.unit || "sheets",
      deadline: q.deadline,
      priority: q.priority,
      status: "Deficit",
    });
  });
  return defs;
}

export interface ToolingDeficitRow {
  id: string;
  workOrderId: string;
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

    items.forEach((item) => {
      if (item.status === "Ready" || item.status === "Delivered" || item.status === "Mounted") return;

      let orderType: ToolingOrderRecord["orderType"] = "ctp_plates";
      if (item.category === "die_cutting") orderType = "die_tooling";
      else if (item.category === "foil_cliche" || item.category === "emboss_cliche") orderType = "cliche";
      else if (item.category === "varnish_plate") orderType = "outsourcing";

      const isAlreadyOrdered = orders.some(
        (o) =>
          !!o.workOrderNo &&
          o.workOrderNo.trim().toLowerCase() === woNo.toLowerCase() &&
          o.orderType === orderType &&
          o.status !== "Cancelled"
      );
      if (isAlreadyOrdered) return;

      list.push({
        id: `DEF-${q.id}-${item.id || item.category}`,
        workOrderId: woNo,
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
