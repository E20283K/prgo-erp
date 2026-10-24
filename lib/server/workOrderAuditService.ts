import { db, writeAuditLog } from "@/db";
import { auditLogs, workOrders, companies } from "@/db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";
import type {
  WorkOrderHistoryEntry,
  HistoryEventCategory,
  HistoryDiffItem,
} from "@/components/documents/work-order/types";

interface AuditAuthor {
  id?: string;
  name: string;
  role?: string;
  initials?: string;
}

interface RecordAuditParams {
  companyId: string;
  workOrderId?: string;
  docNo: string;
  action: "create" | "update" | "post" | "unpost" | "delete";
  author: AuditAuthor;
  category: HistoryEventCategory;
  actionText: string;
  details?: string;
  diffs?: HistoryDiffItem[];
  badgeText?: string;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  oldDataSnapshot?: Record<string, unknown>;
  newDataSnapshot?: Record<string, unknown>;
}

/**
 * Audit log jadvaliga bitta yozuv kiritish
 */
export async function recordWorkOrderAuditLog(params: RecordAuditParams): Promise<void> {
  const {
    companyId,
    workOrderId,
    docNo,
    action,
    author,
    category,
    actionText,
    details,
    diffs = [],
    badgeText,
    badgeVariant = "outline",
    oldDataSnapshot = {},
    newDataSnapshot = {},
  } = params;

  const authorInitials =
    author.initials ||
    (author.name
      ? author.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "OP");

  const authorName = author.name || "Operator";
  const authorRole = author.role || "Operator";

  await writeAuditLog({
    companyId,
    userId: author.id || null,
    userName: authorName,
    entityType: "work_order",
    entityId: docNo,
    action,
    oldData: oldDataSnapshot,
    newData: {
      docNo,
      workOrderId,
      category,
      action: actionText,
      details,
      diffs,
      badgeText,
      badgeVariant,
      authorRole,
      authorInitials,
      ...newDataSnapshot,
    },
  });
}

/**
 * Maydonlarning inson tushunadigan o'zbekcha nomlari va kategoriyasi
 */
const AUDIT_FIELD_MAP: Record<
  string,
  { label: string; category: HistoryEventCategory; format?: (v: any) => string }
> = {
  status: { label: "Hujjat holati", category: "status" },
  stage: { label: "Ishlab chiqarish bosqichi", category: "status" },
  priority: { label: "Ustuvorlik darajasi", category: "status" },
  orderType: { label: "Buyurtma turi", category: "status" },

  customerName: { label: "Mijoz nomi", category: "spec" },
  productName: { label: "Mahsulot nomi", category: "spec" },
  quantity: {
    label: "Buyurtma tiraji",
    category: "spec",
    format: (v) => (v !== undefined && v !== null ? `${Number(v).toLocaleString()} dona` : "-"),
  },
  unit: { label: "O'lchov birligi", category: "spec" },
  paperStock: { label: "Qog'oz / Material", category: "spec" },
  coating: { label: "Qoplama / Lak", category: "spec" },
  lamination: { label: "Laminatsiya", category: "spec" },
  embellishment: { label: "Qo'shimcha pardoz", category: "spec" },
  recipeCode: { label: "Retsept kodi", category: "spec" },
  priceTotal: {
    label: "Umumiy summa",
    category: "spec",
    format: (v) => (v !== undefined && v !== null ? `${Number(v).toLocaleString()} so'm` : "-"),
  },

  pressMachine: { label: "Bosma uskunasi", category: "planning" },
  department: { label: "Sex / Yo'nalish", category: "planning" },
  startDate: { label: "Boshlanish sanasi", category: "planning" },
  deadline: { label: "Topshirish muddati", category: "planning" },
};

function formatVal(val: any, formatter?: (v: any) => string): string {
  if (val === undefined || val === null || val === "") return "(Bo'sh)";
  if (formatter) return formatter(val);
  if (typeof val === "boolean") return val ? "Tayyor" : "Bajarilmagan";
  return String(val);
}

/**
 * WorkOrder eski va yangi ma'lumotlarini taqqoslab, toifalar bo'yicha audit yozuvlarini yaratish
 */
export async function computeAndRecordWorkOrderDiffs(params: {
  companyId: string;
  docNo: string;
  workOrderId: string;
  existingOrder: any;
  payload: any;
  author: AuditAuthor;
}): Promise<void> {
  const { companyId, docNo, workOrderId, existingOrder, payload, author } = params;

  const diffsByCategory: Record<HistoryEventCategory, HistoryDiffItem[]> = {
    status: [],
    spec: [],
    material: [],
    planning: [],
    system: [],
  };

  // 1. Asosiy ustunlar bo'yicha solishtirish
  for (const [field, meta] of Object.entries(AUDIT_FIELD_MAP)) {
    const oldVal = existingOrder[field];
    const newVal = payload[field];

    if (newVal !== undefined && String(oldVal ?? "").trim() !== String(newVal ?? "").trim()) {
      diffsByCategory[meta.category].push({
        field,
        fieldLabel: meta.label,
        oldValue: formatVal(oldVal, meta.format),
        newValue: formatVal(newVal, meta.format),
      });
    }
  }

  // 2. Texnik o'lchamlar (dimensions) bo'yicha solishtirish
  const oldDims = (existingOrder.dimensions as any) || {};
  const newDims = (payload.dimensions as any) || {};

  const dimFields: Array<{ key: string; label: string; format?: (v: any) => string }> = [
    { key: "width", label: "Eni (W)", format: (v) => `${v} mm` },
    { key: "height", label: "Bo'yi (H)", format: (v) => `${v} mm` },
    { key: "bleed", label: "Chiqish maydoni (Bleed)", format: (v) => `${v} mm` },
    { key: "boxDepth", label: "Quti chuqurligi (D)", format: (v) => `${v} mm` },
    { key: "shapeType", label: "Shakl turi" },
    { key: "cornerType", label: "Burchak shakli" },
    { key: "foldType", label: "Buklama turi" },
    { key: "boxType", label: "Quti konstruksiyasi" },
    { key: "kashirovkaMode", label: "Kashirovka usuli" },
  ];

  for (const item of dimFields) {
    const oV = oldDims[item.key];
    const nV = newDims[item.key];
    if (nV !== undefined && String(oV ?? "").trim() !== String(nV ?? "").trim()) {
      diffsByCategory.spec.push({
        field: `dimensions.${item.key}`,
        fieldLabel: item.label,
        oldValue: formatVal(oV, item.format),
        newValue: formatVal(nV, item.format),
      });
    }
  }

  // 3. Tayyorlik tekshiruvlari (checks / QC / System)
  const oldChecks = (existingOrder.checks as any) || {};
  const newChecks = (payload.checks as any) || {};

  const checkFields: Array<{ key: string; label: string }> = [
    { key: "designReady", label: "Prepress dizayn tayyorligi" },
    { key: "paperReady", label: "Qog'oz / Ombor tayyorligi" },
    { key: "platesReady", label: "CTP qoliplari tayyorligi" },
    { key: "toolingReady", label: "Shtamp / Pichoq tayyorligi" },
  ];

  for (const cf of checkFields) {
    const oC = !!oldChecks[cf.key];
    const nC = !!newChecks[cf.key];
    if (oC !== nC) {
      diffsByCategory.system.push({
        field: `checks.${cf.key}`,
        fieldLabel: cf.label,
        oldValue: oC ? "Tayyor" : "Kutilmoqda",
        newValue: nC ? "Tayyor" : "Kutilmoqda",
      });
    }
  }

  // 4. Materiallar (Materials / BOM)
  const oldMaterials = Array.isArray(oldDims.materials) ? oldDims.materials : [];
  const newMaterials = Array.isArray(newDims.materials) ? newDims.materials : [];
  if (oldMaterials.length !== newMaterials.length && newMaterials.length > 0) {
    diffsByCategory.material.push({
      field: "materials",
      fieldLabel: "Xomashyo spetsifikatsiyasi (BOM)",
      oldValue: `${oldMaterials.length} ta material`,
      newValue: `${newMaterials.length} ta material`,
    });
  }

  // 5. Har bir toifa bo'yicha alohida audit yozuvini kiritish
  for (const [cat, diffs] of Object.entries(diffsByCategory) as [HistoryEventCategory, HistoryDiffItem[]][]) {
    if (diffs.length === 0) continue;

    let actionText = "Parametrlar yangilandi";
    let badgeText = payload.status || existingOrder.status;
    let badgeVariant: "default" | "secondary" | "outline" | "destructive" = "outline";

    if (cat === "status") {
      actionText = `Holat o'zgartirildi: ${payload.status || existingOrder.status}`;
      badgeText = payload.status;
      badgeVariant = "default";
    } else if (cat === "spec") {
      actionText = "Spetsifikatsiya va o'lchamlar yangilandi";
    } else if (cat === "material") {
      actionText = "Materiallar sarfi (BOM) o'zgartirildi";
    } else if (cat === "planning") {
      actionText = "Rejalashtirish va uskunalar yangilandi";
    } else if (cat === "system") {
      actionText = "Tayyorlik va sifat nazorati (QC) yangilandi";
      badgeText = "QC Tekshiruv";
      badgeVariant = "secondary";
    }

    await recordWorkOrderAuditLog({
      companyId,
      workOrderId,
      docNo,
      action: "update",
      author,
      category: cat,
      actionText,
      details: `${diffs.length} ta parametr o'zgartirildi`,
      diffs,
      badgeText,
      badgeVariant,
      oldDataSnapshot: { fields: diffs.map((d) => d.field) },
      newDataSnapshot: { fields: diffs.map((d) => d.field) },
    });
  }
}

/**
 * Buyurtmaning to'liq audit tarixini bazadan o'qish va HistoryTab formatiga o'tkazish
 */
export async function getWorkOrderAuditHistory(
  companyId: string,
  docNo: string
): Promise<WorkOrderHistoryEntry[]> {
  const logs = await db.query.auditLogs.findMany({
    where: and(
      eq(auditLogs.companyId, companyId),
      eq(auditLogs.entityType, "work_order"),
      eq(auditLogs.entityId, docNo)
    ),
    orderBy: [desc(auditLogs.createdAt)],
  });

  return logs.map((log) => {
    const nd = (log.newData as any) || {};
    const createdDate = new Date(log.createdAt);
    const dateStr = createdDate.toISOString().slice(0, 19).replace("T", " ");

    return {
      id: log.id,
      timestamp: dateStr,
      author: {
        name: log.userName || "Operator",
        role: nd.authorRole || "Operator",
        initials: nd.authorInitials || log.userName?.slice(0, 2).toUpperCase() || "OP",
      },
      category: (nd.category as HistoryEventCategory) || "system",
      action: nd.action || (log.action === "create" ? `Buyurtma yaratildi: ${docNo}` : "Hujjat yangilandi"),
      details: nd.details || (log.action === "create" ? "Yangi buyurtma rasmiylashtirildi" : undefined),
      diffs: Array.isArray(nd.diffs) ? nd.diffs : [],
      badgeText: nd.badgeText || (log.action === "create" ? "Yangi" : undefined),
      badgeVariant: nd.badgeVariant || "outline",
    };
  });
}
