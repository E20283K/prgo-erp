import type { ProductionReadinessChecks, WarehouseStockRecord } from "@/store/workspaceStore";

/**
 * Avtomatlashtirilgan Ishlab Chiqarish Tayyorgarligi (4 Gates Evaluation Engine)
 *
 * Poligrafiya korxonasining real holatiga ko'ra 4 ta omilni avtomatik baholaydi:
 * 1. designReady: Fayl/Eskiz yuklanganmi, Pre-flight tekshirilganmi
 * 2. paperReady: BOMdagi barcha xomashyo omborda yetarlimi yoki mijoz xomashyosimi
 * 3. platesReady: Digital bosmada plita kerak emas (darhol true); Offset/Flexoda forma mavjudligi
 * 4. toolingReady: To'g'ri burchakli mahsulotlarda shtansforma shart emas (gilotina kesim); mavjud pichoqlar
 *
 * AGAR biron-bir darvoza foydalanuvchi tomonidan qo'lda "blocked" (bloklangan) qilingan bo'lsa,
 * avtomatlashtirish uni hurmat qiladi va ustidan yozmaydi (manual blocker preservation).
 */
export function evaluateOrderReadiness(
  order: any,
  warehouseStock: WarehouseStockRecord[] = []
): ProductionReadinessChecks {
  const existingChecks = order?.checks || {};
  const audit = existingChecks.audit || {};

  // 1. DESIGN READY (Prepress / Maket / Fayl)
  let designReady = Boolean(existingChecks.designReady);
  if (audit.designReady?.status === "blocked") {
    designReady = false;
  } else if (!designReady) {
    const hasAttachments = Array.isArray(order.attachments) && order.attachments.length > 0;
    const hasPhotos = Boolean(order.photoUrl) || (Array.isArray(order.photoUrls) && order.photoUrls.length > 0);
    const hasArtworks = Boolean(order.artworkFront) || (Array.isArray(order.skuArtworks) && order.skuArtworks.length > 0);
    if (hasAttachments || hasPhotos || hasArtworks) {
      designReady = true;
    }
  }

  // 2. PAPER / SUBSTRATE READY (Xomashyo va Ombor)
  let paperReady = Boolean(existingChecks.paperReady);
  if (audit.paperReady?.status === "blocked") {
    paperReady = false;
  } else {
    const materials = Array.isArray(order.materials) ? order.materials : [];
    if (materials.length > 0) {
      const hasShortage = materials.some((item: any) => {
        // Mijoz xomashyosi (davalcheskiy) bo'lsa ombor hisobidan kamomad bo'lmaydi
        if (item.acquisitionSource === "client" || item.supplier?.toLowerCase().includes("mijoz")) {
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
          ws.name.toLowerCase().includes(order.paperStock.toLowerCase()) ||
          order.paperStock.toLowerCase().includes(ws.name.toLowerCase())
      );
      if (matched && (matched.available ?? 0) >= (order.quantity || 0)) {
        paperReady = true;
      }
    }
  }

  // 3. PLATES READY (CTP / Pechat qoliplari)
  let platesReady = Boolean(existingChecks.platesReady);
  if (audit.platesReady?.status === "blocked") {
    platesReady = false;
  } else if (!platesReady) {
    // Raqamli chop etish (Digital) yoki Post-press bo'lsa CTP plitasi kerak emas
    if (order.department === "Digital" || order.department === "Post-press") {
      platesReady = true;
    }
  }

  // 4. TOOLING READY (Shtansforma / Vurubka pichoqlari)
  let toolingReady = Boolean(existingChecks.toolingReady);
  if (audit.toolingReady?.status === "blocked") {
    toolingReady = false;
  } else if (!toolingReady) {
    const shapeType = order.shapeType || order.dimensions?.shapeType || "rectangle";
    const customShape = order.customShape || order.dimensions?.customShape;
    const isStandardStraightCut = (shapeType === "rectangle" || shapeType === "standard") && !customShape;
    const needsDieProcurement = Boolean(order.toolingProcurementNeeded || order.dimensions?.toolingProcurementNeeded);

    // Standart to'g'ri burchakli bichim uchun maxsus shtansforma pichog'i kerak emas (gilotina)
    if (isStandardStraightCut && !needsDieProcurement) {
      toolingReady = true;
    } else if (order.selectedToolingId && !needsDieProcurement) {
      toolingReady = true;
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
