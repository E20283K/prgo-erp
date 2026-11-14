import { db } from "@/db";
import { workRates } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type { WorkRateRecord } from "@/components/documents/work-rate/types";
import { getCompanyIdByCode } from "./tariffService";

type WorkRateRow = typeof workRates.$inferSelect;

const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

function toRecord(r: WorkRateRow): WorkRateRecord {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    department: r.department || "",
    defaultMachineId: r.defaultMachineId || null,
    unit: r.unit,
    unitDivisor: r.unitDivisor,
    currency: r.currency,
    pieceRate: Number(r.pieceRate) || 0,
    helperPieceRate: Number(r.helperPieceRate) || 0,
    status: r.status === "Archived" ? "Archived" : "Active",
    notes: r.notes || "",
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function getWorkRates(companyCode = "PRINTGOO"): Promise<WorkRateRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db.query.workRates.findMany({
    where: eq(workRates.companyId, companyId),
    orderBy: [asc(workRates.code)],
  });
  return rows.map(toRecord);
}

async function nextCode(companyId: string): Promise<string> {
  const rows = await db.select({ code: workRates.code }).from(workRates).where(eq(workRates.companyId, companyId));
  const max = rows.reduce((m, r) => {
    const match = r.code.match(/IT-(\d+)/i);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  return `IT-${String(max + 1).padStart(3, "0")}`;
}

export async function upsertWorkRate(
  data: Partial<WorkRateRecord>,
  companyCode = "PRINTGOO"
): Promise<{ success: boolean; workRate?: WorkRateRecord; error?: string }> {
  const companyId = await getCompanyIdByCode(companyCode);
  const name = (data.name || "").trim();
  if (!name) return { success: false, error: "Operatsiya nomi kiritilmagan" };

  const values = {
    name,
    department: data.department?.trim() || null,
    defaultMachineId: data.defaultMachineId && isUuid(data.defaultMachineId) ? data.defaultMachineId : null,
    unit: data.unit || "1,000 sheets",
    unitDivisor: Math.max(1, Math.round(Number(data.unitDivisor) || 1000)),
    currency: (data.currency || "UZS").toUpperCase() === "USD" ? "USD" : "UZS",
    pieceRate: Math.max(0, Number(data.pieceRate) || 0).toFixed(4),
    helperPieceRate: Math.max(0, Number(data.helperPieceRate) || 0).toFixed(4),
    status: data.status === "Archived" ? "Archived" : "Active",
    notes: data.notes?.trim() || null,
    updatedAt: new Date(),
  };

  const existing =
    data.id && isUuid(data.id)
      ? await db.query.workRates.findFirst({
          where: and(eq(workRates.companyId, companyId), eq(workRates.id, data.id)),
        })
      : null;

  if (existing) {
    const [row] = await db
      .update(workRates)
      .set({ ...values, code: data.code?.trim() || existing.code })
      .where(eq(workRates.id, existing.id))
      .returning();
    return { success: true, workRate: toRecord(row) };
  }

  const code = data.code?.trim() && !data.code.startsWith("IT-NEW") ? data.code.trim() : await nextCode(companyId);
  const [row] = await db
    .insert(workRates)
    .values({ ...values, companyId, code })
    .returning();
  return { success: true, workRate: toRecord(row) };
}

export async function deleteWorkRate(id: string, companyCode = "PRINTGOO"): Promise<boolean> {
  if (!isUuid(id)) return false;
  const companyId = await getCompanyIdByCode(companyCode);
  const deleted = await db
    .delete(workRates)
    .where(and(eq(workRates.companyId, companyId), eq(workRates.id, id)))
    .returning({ id: workRates.id });
  return deleted.length > 0;
}
