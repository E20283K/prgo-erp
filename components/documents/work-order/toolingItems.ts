// Ish buyrug'i uchun boshlang'ich jihoz (qolip/klishe) ro'yxati. "use client" siz: server ham ishlatadi.
import type { WorkOrderFormData, WorkOrderToolingItem } from "./types";

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
