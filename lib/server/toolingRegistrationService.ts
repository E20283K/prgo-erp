import { and, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { diesTooling, supplierOrders, workOrders } from "@/db/schema";
import { invalidateCacheByPrefix } from "@/lib/server/redis";

type SupplierOrderRow = typeof supplierOrders.$inferSelect;

/** Rotary cylinder gear pitch: 1/8" per tooth. */
const GEAR_PITCH_MM = 3.175;
const ROTARY_DIE_TYPES = new Set(["rotary_magnetic", "solid_rotary"]);
const CLICHE_DIE_TYPES = new Set(["hot_stamp", "embossing"]);

const positive = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/**
 * A delivered die or cliche order becomes a reusable record in dies_tooling. It carries the
 * order's spec (type, size, ups, Z), drawing file, the work order's photo and its customer, and
 * a link back to the order. One-off CTP plates are not registered.
 *
 * Idempotent: a die already linked to the order (or holding its PO number as code, as the old
 * client-side registration created) is reused, and only its empty source fields are filled in.
 * Runs on every path that marks an order Delivered: the app's save and the supplier's Telegram button.
 */
export async function registerDeliveredTooling(order: SupplierOrderRow) {
  if (order.status !== "Delivered") return null;
  if (order.orderType !== "die_tooling" && order.orderType !== "cliche") return null;

  const code = order.orderNo.trim().toUpperCase();

  const wo = order.workOrderId
    ? await db.query.workOrders.findFirst({
        where: and(eq(workOrders.companyId, order.companyId), eq(workOrders.id, order.workOrderId)),
      })
    : order.workOrderNo?.trim()
      ? await db.query.workOrders.findFirst({
          where: and(
            eq(workOrders.companyId, order.companyId),
            eq(workOrders.docNo, order.workOrderNo.trim())
          ),
        })
      : undefined;
  const drawingIsImage = Boolean(
    order.fileUrl &&
      (/\.(png|jpe?g|webp|gif|svg)$/i.test(order.fileName || order.fileUrl) || order.fileUrl.startsWith("data:image/"))
  );
  // The work order's product photo shows what the die cuts; an image drawing is the fallback
  const imageUrl =
    wo?.photoUrl ||
    (Array.isArray(wo?.photoUrls) && wo.photoUrls.length > 0 ? wo.photoUrls[0] : null) ||
    (drawingIsImage ? order.fileUrl : null);
  const workOrderNo = order.workOrderNo || wo?.docNo || null;

  const [existing] = await db
    .select()
    .from(diesTooling)
    .where(
      and(
        eq(diesTooling.companyId, order.companyId),
        or(eq(diesTooling.sourceOrderId, order.id), eq(diesTooling.code, code))
      )
    )
    .limit(1);

  if (existing) {
    const backfill: Partial<typeof diesTooling.$inferInsert> = {};
    if (!existing.sourceOrderId) backfill.sourceOrderId = order.id;
    if (!existing.sourceOrderNo) backfill.sourceOrderNo = order.orderNo;
    if (!existing.workOrderNo && workOrderNo) backfill.workOrderNo = workOrderNo;
    if (!existing.fileUrl && order.fileUrl) {
      backfill.fileUrl = order.fileUrl;
      backfill.fileName = order.fileName;
    }
    if (!existing.imageUrl && imageUrl) backfill.imageUrl = imageUrl;
    if (!existing.customerId && wo?.clientId) backfill.customerId = wo.clientId;
    if (Object.keys(backfill).length === 0) return existing;
    const [updated] = await db
      .update(diesTooling)
      .set({ ...backfill, updatedAt: new Date() })
      .where(eq(diesTooling.id, existing.id))
      .returning();
    await invalidateCacheByPrefix("master:tooling");
    return updated;
  }

  const spec = order.toolingSpec || {};
  const dieType = spec.dieType || (order.orderType === "cliche" ? "hot_stamp" : "flatbed");
  const isRotary = ROTARY_DIE_TYPES.has(dieType);
  const isCliche = CLICHE_DIE_TYPES.has(dieType);
  const cylinderTeeth = isRotary ? positive(spec.cylinderTeeth) : null;
  const customerName = wo?.customerName?.trim() || null;

  const [inserted] = await db
    .insert(diesTooling)
    .values({
      companyId: order.companyId,
      code,
      name: order.title,
      dieType,
      shape: isCliche ? "rectangle" : spec.shape || "rectangle",
      widthMm: String(positive(spec.widthMm) ?? 50),
      heightMm: String(positive(spec.heightMm) ?? 50),
      cornerRadiusMm: String(isCliche ? 0 : positive(spec.cornerRadiusMm) ?? 0),
      acrossCount: isCliche ? 1 : Math.round(positive(spec.acrossCount) ?? 1),
      aroundCount: isCliche ? 1 : Math.round(positive(spec.aroundCount) ?? 1),
      cylinderTeeth: cylinderTeeth ? Math.round(cylinderTeeth) : null,
      repeatLengthMm: cylinderTeeth ? (cylinderTeeth * GEAR_PITCH_MM).toFixed(3) : null,
      status: "available",
      customerId: wo?.clientId || null,
      customerName,
      ownership: customerName ? "customer_owned" : "in_house",
      isDedicated: Boolean(customerName),
      imageUrl,
      fileUrl: order.fileUrl,
      fileName: order.fileName,
      sourceOrderId: order.id,
      sourceOrderNo: order.orderNo,
      workOrderNo,
      notes: order.specDetails || null,
    })
    .returning();

  await invalidateCacheByPrefix("master:tooling");
  return inserted;
}
