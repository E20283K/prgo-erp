import { db } from "@/db";
import { finishingOptions } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

export const FINISHING_KINDS = ["lamination", "coating", "embellishment"] as const;
export type FinishingKind = (typeof FINISHING_KINDS)[number];

export function isFinishingKind(value: unknown): value is FinishingKind {
  return typeof value === "string" && (FINISHING_KINDS as readonly string[]).includes(value);
}

export interface FinishingOptionRecord {
  id: string;
  kind: FinishingKind;
  value: string;
  label: string;
}

/** Faol pardoz turlari: avval tartib raqami, keyin nomi bo'yicha. */
export async function getFinishingOptions(companyCode: string = "PRINTGOO"): Promise<FinishingOptionRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);
  const rows = await db
    .select({
      id: finishingOptions.id,
      kind: finishingOptions.kind,
      value: finishingOptions.value,
      label: finishingOptions.label,
    })
    .from(finishingOptions)
    .where(and(eq(finishingOptions.companyId, companyId), eq(finishingOptions.isActive, true)))
    .orderBy(asc(finishingOptions.kind), asc(finishingOptions.sortOrder), asc(finishingOptions.label));
  return rows.filter((r): r is FinishingOptionRecord => isFinishingKind(r.kind));
}

/**
 * Yangi tur qo'shadi. Shu turda bir xil nom (katta-kichik harfdan qat'i nazar) bo'lsa,
 * dublikat ochmasdan mavjudini qaytaradi.
 */
export async function createFinishingOption(
  kind: unknown,
  rawName: string,
  companyCode: string = "PRINTGOO"
): Promise<FinishingOptionRecord> {
  if (!isFinishingKind(kind)) throw new Error("Tur nomi: noma'lum bo'lim");
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Tur nomi kiritilishi shart");
  if (name.length > 255) throw new Error("Tur nomi 255 belgidan oshmasligi kerak");
  if (name.toLowerCase() === "none") throw new Error("Tur nomi band");

  const companyId = await getCompanyIdByCode(companyCode);

  const [existing] = await db
    .select({
      id: finishingOptions.id,
      value: finishingOptions.value,
      label: finishingOptions.label,
      isActive: finishingOptions.isActive,
    })
    .from(finishingOptions)
    .where(
      and(
        eq(finishingOptions.companyId, companyId),
        eq(finishingOptions.kind, kind),
        sql`(lower(${finishingOptions.value}) = lower(${name}) OR lower(${finishingOptions.label}) = lower(${name}))`
      )
    )
    .limit(1);

  if (existing) {
    if (!existing.isActive) {
      await db.update(finishingOptions).set({ isActive: true }).where(eq(finishingOptions.id, existing.id));
    }
    return { id: existing.id, kind, value: existing.value, label: existing.label };
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${finishingOptions.sortOrder}), 0) + 1` })
    .from(finishingOptions)
    .where(and(eq(finishingOptions.companyId, companyId), eq(finishingOptions.kind, kind)));

  const [created] = await db
    .insert(finishingOptions)
    .values({ companyId, kind, value: name, label: name, sortOrder: Number(next) })
    .returning({ id: finishingOptions.id, value: finishingOptions.value, label: finishingOptions.label });
  return { id: created.id, kind, value: created.value, label: created.label };
}
