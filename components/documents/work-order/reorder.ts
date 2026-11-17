// Takroriy buyurtma: asl buyurtma shablon sifatida olinadi — klishe/CTP qoliplari, texnologik
// marshrut va xomashyo (BOM) qayta kiritilmaydi. Asl buyurtmada bajarilgan ish, uning savdo
// bog'lanishlari va tasdiq auditi esa yangi buyurtmaga o'tmaydi. Mijozni almashtirish mumkin:
// bitta brend mahsulotini bir nechta tashkilot buyurtma qilishi odatiy holat.
import type { WorkOrderToolingItem } from "./types";

type Row = Record<string, unknown>;

/** Asl buyurtmada mavjud bo'lgan, qayta ishlatiladigan jihoz holatlari. */
const EXISTING_TOOLING_STATUSES = new Set(["Ready", "Delivered", "Mounted"]);

const PLATE_CATEGORIES = new Set(["ctp_plates", "flexo_polymer"]);
const DIE_CATEGORIES = new Set(["die_cutting", "foil_cliche", "emboss_cliche", "varnish_plate"]);

/** Faqat asl buyurtmaga tegishli, yangi buyurtmaga ko'chirilmaydigan maydonlar. */
const SOURCE_ONLY_FIELDS = [
  "id",
  "docNo",
  "createdAt",
  "updatedAt",
  "actualEndDate",
  "cancelReason",
  "linkedOrderId",
  "contractNo",
  "clientId",
  "customerTin",
  "deliveryBatches",
  "packagingData",
  "materialsReserved",
  "materialsReservedAt",
  "materialsConsumed",
  "materialsConsumedAt",
  "materialIssueDocNo",
  "shiftNotes",
  "events",
  "shippedQty",
  "invoicedQty",
  "completedSheets",
  "operator",
  "shift",
] as const;

function todayIso(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().split("T")[0];
}

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value as Row[]) : [];
}

function resetOperations(ops: unknown, quantity: number): Row[] {
  return rows(ops).map((op, idx) => ({
    ...op,
    // Asl buyurtma bosqichining baza ID si qolsa, saqlashda o'sha qatorga to'qnashadi.
    id: `op-reorder-${idx + 1}`,
    status: "Queued",
    phase: undefined,
    qtyCompleted: `0 / ${quantity.toLocaleString()}`,
    completedQty: 0,
    plannedQty: quantity,
    startedAt: undefined,
    pausedAt: undefined,
    completedAt: undefined,
    curingStartedAt: undefined,
    actualDurationMinutes: undefined,
    downtimeMinutes: 0,
  }));
}

function resetMaterials(items: unknown): Row[] {
  return rows(items).map((item) => {
    const planQty = Number(item.planQty ?? item.quantity ?? item.qty ?? 0) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return {
      ...item,
      planQty,
      actualQty: planQty,
      wasteQty: 0,
      qty: planQty,
      totalPrice: Number((planQty * unitPrice).toFixed(2)),
      batchNo: "",
      issueType: undefined,
      faultParty: undefined,
    };
  });
}

function reuseTooling(items: unknown, parentDocNo: string): WorkOrderToolingItem[] {
  return (rows(items) as unknown as WorkOrderToolingItem[]).map((item) => {
    const base: WorkOrderToolingItem = {
      ...item,
      isRemake: false,
      remakeReason: undefined,
      faultParty: undefined,
      jobTicketPrinted: false,
      phase: "production",
    };
    if (!EXISTING_TOOLING_STATUSES.has(item.status)) return base;
    // Jihoz bizda bor: qayta buyurtma qilinmaydi va bu buyurtma tannarxiga kirmaydi.
    return {
      ...base,
      status: "Ready",
      estimatedCost: 0,
      actualCost: 0,
      notes: `${parentDocNo} dan qayta ishlatiladi`,
    };
  });
}

function readinessFromTooling(tooling: WorkOrderToolingItem[], designReady: boolean) {
  const plates = tooling.filter((t) => PLATE_CATEGORIES.has(t.category));
  const dies = tooling.filter((t) => DIE_CATEGORIES.has(t.category));
  return {
    designReady,
    paperReady: false,
    platesReady: plates.length > 0 && plates.every((t) => t.status === "Ready"),
    toolingReady: dies.length > 0 && dies.every((t) => t.status === "Ready"),
  };
}

/**
 * Asl buyurtmadan yangi qoralama (Draft) hujjat ma'lumotini tuzadi.
 * `overrides` — chaqiruvchi o'zgartiradigan maydonlar (masalan, mijoz kartasidan ochilganda mijoz).
 */
export function buildReorderDocument(
  source: Row,
  opts: { parentDocNo: string; draftId: string; overrides?: Row }
): Row {
  const doc: Row = { ...source, ...(opts.overrides || {}) };
  for (const key of SOURCE_ONLY_FIELDS) delete doc[key];

  const dims = (source.dimensions || {}) as Row;
  const quantity = Number(doc.quantity) || 0;
  const tooling = reuseTooling(source.toolingItems ?? dims.toolingItems, opts.parentDocNo);
  const sourceChecks = (source.checks || {}) as Row;

  return {
    ...doc,
    id: opts.draftId,
    docNo: "",
    parentWorkOrderId: opts.parentDocNo,
    isReorder: true,
    status: "Draft",
    stage: "Queue",
    orderType: "Production",
    sampleRequired: false,
    orderDate: todayIso(),
    startDate: todayIso(),
    deadline: todayIso(7),
    operations: resetOperations(source.operations, quantity),
    materials: resetMaterials(source.materials ?? dims.materials),
    toolingItems: tooling,
    toolingProcurementNeeded: tooling.some((t) => t.status !== "Ready"),
    // Tasdiqlovchining auditi asl buyurtmaga tegishli; tayyorlik jihozlar holatidan qayta olinadi.
    checks: readinessFromTooling(tooling, Boolean(sourceChecks.designReady)),
    milestones: rows(source.milestones).map((m) => ({ ...m, status: "Pending" })),
    // Brend etaloni bir marta tasdiqlangan: mijoz almashsa ham dizayn o'sha.
    sampleData: {
      ...((source.sampleData || {}) as Row),
      isRequired: false,
      approvalStatus: "approved",
      qcPassed: true,
      isProduced: true,
      technicalNotes: `Takroriy buyurtma: ${opts.parentDocNo} tasdiqlangan etaloni asosida`,
    },
  };
}
