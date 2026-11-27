import { db } from "@/db";
import { supplierOrders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { getWorkOrders } from "./workOrderService";
import { computeToolingDeficits, type ToolingDeficitRow } from "@/lib/deficits";

const isData = (v?: string) => !!v && v.startsWith("data:");

/**
 * Tooling items open work orders still need and no supplier order covers, computed on the server
 * so the tooling screen does not download every work order. Embedded files (data: URLs) are left
 * out of the rows; such a row is marked `listPartial` and the screen loads the work order's own
 * item before ordering it.
 */
export async function getToolingDeficits(companyCode: string = "PRINTGOO"): Promise<ToolingDeficitRow[]> {
  const companyId = await getCompanyIdByCode(companyCode);
  const [queue, orders] = await Promise.all([
    getWorkOrders(companyCode, { excludeCompleted: true }),
    db
      .select({
        workOrderNo: supplierOrders.workOrderNo,
        orderNo: supplierOrders.orderNo,
        toolingItemId: supplierOrders.toolingItemId,
        title: supplierOrders.title,
        orderType: supplierOrders.orderType,
        status: supplierOrders.status,
      })
      .from(supplierOrders)
      .where(eq(supplierOrders.companyId, companyId)),
  ]);

  return computeToolingDeficits(queue, orders).map((row) => {
    const embedded = isData(row.item.fileUrl) || isData(row.item.imageUrl) || isData(row.fileUrl);
    if (!embedded) return row;
    const wo = queue.find((q) => (q.id || q.docNo || "").trim() === row.workOrderId);
    const woPhoto = wo?.photoUrl || (Array.isArray(wo?.photoUrls) ? wo.photoUrls[0] : undefined);
    return {
      ...row,
      item: {
        ...row.item,
        fileUrl: isData(row.item.fileUrl) ? undefined : row.item.fileUrl,
        imageUrl: isData(row.item.imageUrl) ? undefined : row.item.imageUrl,
      },
      fileUrl: isData(row.fileUrl) ? undefined : row.fileUrl,
      imageUrl: isData(row.item.imageUrl) ? woPhoto : row.imageUrl,
      listPartial: true,
    };
  });
}
