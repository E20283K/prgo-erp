import { db } from "@/db";
import {
  clientPayments,
  supplierOrders,
  telegramChats,
  warehouseDispatchManifests,
  warehouseFinishedGoods,
  warehouseInventoryCounts,
  warehouseReceipts,
  warehouseShipments,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { getWorkOrders } from "./workOrderService";
import { getStockBalances, getWarehouseMovements } from "./warehouseService";
import { computeMaterialDeficits, computeToolingDeficits } from "@/lib/deficits";

/** modul -> sidebar bandi -> hal qilinishi kerak bo'lgan yozuvlar soni */
export type NavBadgeCounts = Record<string, Record<string, number>>;

export type NavBadgeModule = "production" | "warehouse" | "crm" | "finance";
export const NAV_BADGE_MODULES: NavBadgeModule[] = ["production", "warehouse", "crm", "finance"];

async function countWhere(table: any, where: any): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return row?.n ?? 0;
}

type Queue = Awaited<ReturnType<typeof getWorkOrders>>;

// Yakunlanmagan ko'chirishlar: qabul qiluvchi tomon hali tasdiqlamagan
const OPEN_MOVEMENT = new Set(["Pending", "In Transit"]);
const ISSUE_TYPES = new Set(["ProductionIssue", "ProductionReturn", "CuttingReturn"]);

async function productionBadges(queue: Queue, companyId: string) {
  const orders = await db
    .select({
      workOrderNo: supplierOrders.workOrderNo,
      orderNo: supplierOrders.orderNo,
      toolingItemId: supplierOrders.toolingItemId,
      title: supplierOrders.title,
      orderType: supplierOrders.orderType,
      status: supplierOrders.status,
    })
    .from(supplierOrders)
    .where(eq(supplierOrders.companyId, companyId));
  return {
    "tooling-orders": computeToolingDeficits(queue, orders).length,
  };
}

async function warehouseBadges(queue: Queue, companyCode: string, companyId: string) {
  const [stock, movements, receipts, shipments, pendingFg, inventory, manifests] = await Promise.all([
    getStockBalances(companyCode),
    getWarehouseMovements(companyCode),
    countWhere(
      warehouseReceipts,
      and(
        eq(warehouseReceipts.companyId, companyId),
        inArray(warehouseReceipts.status, ["Draft", "Inspecting", "Quarantine"])
      )
    ),
    countWhere(
      warehouseShipments,
      and(
        eq(warehouseShipments.companyId, companyId),
        inArray(warehouseShipments.status, ["Draft", "Reserved", "Picking", "Packed"])
      )
    ),
    countWhere(
      warehouseFinishedGoods,
      and(eq(warehouseFinishedGoods.companyId, companyId), sql`${warehouseFinishedGoods.pendingQuantity} > 0`)
    ),
    countWhere(
      warehouseInventoryCounts,
      and(eq(warehouseInventoryCounts.companyId, companyId), eq(warehouseInventoryCounts.status, "Draft"))
    ),
    countWhere(
      warehouseDispatchManifests,
      and(
        eq(warehouseDispatchManifests.companyId, companyId),
        inArray(warehouseDispatchManifests.status, ["Draft", "Loading"])
      )
    ),
  ]);

  const openMovements = movements.filter((m) => OPEN_MOVEMENT.has(m.status));
  return {
    requirements: computeMaterialDeficits(queue, stock as any).length,
    "finished-goods": pendingFg,
    receipts,
    shipments,
    movements: openMovements.filter((m) => m.movementType === "Transfer").length,
    "production-issue": openMovements.filter((m) => ISSUE_TYPES.has(m.movementType)).length,
    inventory,
    manifests,
  };
}

async function crmBadges(companyId: string) {
  // Hali mijoz yoki ta'minotchiga bog'lanmagan Telegram chatlar
  const unlinked = await countWhere(
    telegramChats,
    and(eq(telegramChats.companyId, companyId), eq(telegramChats.status, "unlinked"))
  );
  return { "telegram-inbox": unlinked };
}

async function financeBadges(companyId: string) {
  const pending = await countWhere(
    clientPayments,
    and(eq(clientPayments.companyId, companyId), eq(clientPayments.status, "pending"))
  );
  return { payments: pending };
}

export async function getNavBadges(
  companyCode: string,
  allowed: Record<NavBadgeModule, boolean>
): Promise<NavBadgeCounts> {
  if (!NAV_BADGE_MODULES.some((m) => allowed[m])) return {};

  const needsQueue = allowed.production || allowed.warehouse;
  const [companyId, queue] = await Promise.all([
    getCompanyIdByCode(companyCode),
    needsQueue ? getWorkOrders(companyCode, { excludeCompleted: true }) : Promise.resolve([] as Queue),
  ]);

  const [production, warehouse, crm, finance] = await Promise.all([
    allowed.production ? productionBadges(queue, companyId) : null,
    allowed.warehouse ? warehouseBadges(queue, companyCode, companyId) : null,
    allowed.crm ? crmBadges(companyId) : null,
    allowed.finance ? financeBadges(companyId) : null,
  ]);

  const out: NavBadgeCounts = {};
  if (production) out.production = production;
  if (warehouse) out.warehouse = warehouse;
  if (crm) out.crm = crm;
  if (finance) out.finance = finance;
  return out;
}
