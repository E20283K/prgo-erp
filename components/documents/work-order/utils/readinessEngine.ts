import type { ProductionReadinessChecks, WarehouseStockRecord } from "@/store/workspaceStore";
import type { WorkOrderFormData, WorkOrderToolingItem } from "../types";
import type { BomItem } from "../../BomMaterialsGrid";

/**
 * Checks whether a specific tooling item (CTP plate, die knife, cliche) is ready for production.
 * "Ready", "Delivered", or "Mounted" are considered ready states.
 */
function isToolingItemReady(item?: WorkOrderToolingItem | { status?: string }): boolean {
  if (!item) return false;
  const status = String(item.status || "").toLowerCase().trim();
  return status === "ready" || status === "delivered" || status === "mounted";
}

export type OrderReadinessInput = Partial<WorkOrderFormData> & {
  checks?: ProductionReadinessChecks;
  preflightPassed?: boolean;
  artworkApproved?: boolean;
  paperStock?: string;
  shapeType?: string;
  customShape?: string;
  dimensions?: {
    shapeType?: string;
    customShape?: string;
    toolingProcurementNeeded?: boolean;
  };
  platesRequired?: boolean;
  noPlatesNeeded?: boolean;
  selectedToolingId?: string;
  [key: string]: unknown;
};

/**
 * Avtomatlashtirilgan Ishlab Chiqarish Tayyorgarligi (4 Gates Evaluation Engine)
 *
 * Poligrafiya korxonasining real holatiga ko'ra 4 ta omilni avtomatik baholaydi:
 * 1. designReady: Fayl/Eskiz yuklanganmi, Pre-flight tekshirilganmi
 * 2. paperReady: BOMdagi barcha xomashyo omborda yetarlimi yoki mijoz xomashyosimi
 * 3. platesReady: Digital bosmada plita kerak emas (darhol true); Offset/Flexoda CTP va formalar holati Ready
 * 4. toolingReady: To'g'ri burchakli mahsulotlarda shtansforma shart emas (gilotina kesim); toolingItems pichoqlari Ready
 *
 * AGAR biron-bir darvoza foydalanuvchi tomonidan qo'lda "blocked" (bloklangan) qilingan bo'lsa,
 * avtomatlashtirish uni hurmat qiladi va ustidan yozmaydi (manual blocker preservation).
 */
export function evaluateOrderReadiness(
  order: OrderReadinessInput,
  warehouseStock: WarehouseStockRecord[] = []
): ProductionReadinessChecks {
  const existingChecks = order?.checks || ({} as ProductionReadinessChecks);
  const audit = existingChecks.audit || ({} as NonNullable<ProductionReadinessChecks["audit"]>);

  // 1. DESIGN READY (Prepress / Maket / Fayl)
  let designReady = Boolean(existingChecks.designReady);
  if (audit.designReady?.status === "blocked") {
    designReady = false;
  } else if (audit.designReady?.verifiedBy) {
    // Inson tomonidan qo'lda tasdiqlangan (Manual Override)
    designReady = audit.designReady.status === "ready";
  } else if (existingChecks.designReady !== undefined) {
    designReady = Boolean(existingChecks.designReady);
  } else {
    // Faqat rasman Pre-flight tekshirilgan fayl bo'lsa yoki Prepress tasdiqlasa tayyor
    const isPreflightApproved = Boolean(order.preflightPassed || order.artworkApproved);
    designReady = isPreflightApproved;
  }

  // 2. PAPER / SUBSTRATE READY (Xomashyo va Ombor)
  let paperReady = Boolean(existingChecks.paperReady);
  if (audit.paperReady?.status === "blocked") {
    paperReady = false;
  } else if (audit.paperReady?.verifiedBy) {
    // Inson tomonidan qo'lda tasdiqlangan (Manual Override)
    paperReady = audit.paperReady.status === "ready";
  } else {
    const materials = Array.isArray(order.materials) ? (order.materials as BomItem[]) : [];
    if (materials.length > 0) {
      const hasShortage = materials.some((item: BomItem) => {
        // Mijoz xomashyosi (davalcheskiy) bo'lsa ombor hisobidan kamomad bo'lmaydi
        const itemAny = item as unknown as Record<string, unknown>;
        const acqSource = String(itemAny.acquisitionSource || "");
        const supplierName = String(item.supplier || "").toLowerCase();
        if (acqSource === "client" || supplierName.includes("mijoz")) {
          return false;
        }
        if (item.availability === "On Order") {
          return true;
        }
        const matched = warehouseStock.find(
          (ws) =>
            ws.sku.toLowerCase() === (item.id || "").toLowerCase() ||
            ws.name.toLowerCase() === (item.name || "").toLowerCase()
        );
        if (matched) {
          const req = item.actualQty !== undefined ? item.actualQty : (item.qty || 0);
          return req > (matched.available ?? 0);
        }
        return false;
      });
      paperReady = !hasShortage;
    } else if (order.paperStock && warehouseStock.length > 0) {
      const matched = warehouseStock.find(
        (ws) =>
          ws.name.toLowerCase().includes(order.paperStock!.toLowerCase()) ||
          order.paperStock!.toLowerCase().includes(ws.name.toLowerCase())
      );
      if (matched && (matched.available ?? 0) >= (Number(order.quantity) || 0)) {
        paperReady = true;
      } else {
        paperReady = false;
      }
    } else {
      // Qog'oz ham, material ham tanlanmagan bo'lsa - qog'oz tayyor emas
      paperReady = false;
    }
  }

  // 3. PLATES READY (CTP / Pechat qoliplari)
  let platesReady = false;
  if (audit.platesReady?.status === "blocked") {
    platesReady = false;
  } else if (audit.platesReady?.verifiedBy) {
    // Inson tomonidan qo'lda tasdiqlangan (Manual Override)
    platesReady = audit.platesReady.status === "ready";
  } else {
    const toolingList = Array.isArray(order.toolingItems) ? (order.toolingItems as WorkOrderToolingItem[]) : [];
    const plateItems = toolingList.filter(
      (item) =>
        item.category === "ctp_plates" ||
        item.category === "flexo_polymer" ||
        item.category === "varnish_plate"
    );

    if (plateItems.length > 0) {
      // Barcha kiritilgan CTP va bosma formalar "Ready", "Delivered" yoki "Mounted" bo'lgandagina yashil
      platesReady = plateItems.every(isToolingItemReady);
    } else {
      // Raqamli chop etish (Digital) yoki Post-press bo'lsa CTP plitasi kerak emas
      const dept = String(order.department || "");
      if (dept === "Digital" || dept === "Post-press") {
        platesReady = true;
      } else if (order.platesRequired === false || order.noPlatesNeeded === true) {
        platesReady = true;
      } else if (existingChecks.platesReady !== undefined) {
        platesReady = Boolean(existingChecks.platesReady);
      } else {
        platesReady = false;
      }
    }
  }

  // 4. TOOLING READY (Shtansforma / Vurubka pichoqlari)
  let toolingReady = false;
  if (audit.toolingReady?.status === "blocked") {
    toolingReady = false;
  } else if (audit.toolingReady?.verifiedBy) {
    // Inson tomonidan qo'lda tasdiqlangan (Manual Override)
    toolingReady = audit.toolingReady.status === "ready";
  } else {
    const toolingList = Array.isArray(order.toolingItems) ? (order.toolingItems as WorkOrderToolingItem[]) : [];
    const knifeItems = toolingList.filter(
      (item) =>
        item.category === "die_cutting" ||
        item.category === "foil_cliche" ||
        item.category === "emboss_cliche"
    );

    if (knifeItems.length > 0) {
      // Barcha zaruriy shtans-forma va pichoqlar "Ready", "Delivered" yoki "Mounted" bo'lgandagina yashil
      toolingReady = knifeItems.every(isToolingItemReady);
    } else {
      const shapeType = order.shapeType || order.dimensions?.shapeType || "rectangle";
      const customShape = order.customShape || order.dimensions?.customShape;
      const isStandardStraightCut = (shapeType === "rectangle" || shapeType === "standard") && !customShape;
      const needsDieProcurement = Boolean(order.toolingProcurementNeeded || order.dimensions?.toolingProcurementNeeded);

      // Standart to'g'ri burchakli bichim uchun maxsus shtansforma pichog'i kerak emas (gilotina)
      if (isStandardStraightCut && !needsDieProcurement) {
        toolingReady = true;
      } else if (order.selectedToolingId && !needsDieProcurement) {
        toolingReady = true;
      } else if (needsDieProcurement) {
        toolingReady = false;
      } else if (existingChecks.toolingReady !== undefined) {
        toolingReady = Boolean(existingChecks.toolingReady);
      } else {
        toolingReady = false;
      }
    }
  }

  return {
    designReady,
    paperReady,
    platesReady,
    toolingReady,
    audit,
  };
}
