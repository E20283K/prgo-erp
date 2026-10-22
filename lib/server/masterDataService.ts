import { eq, and, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import {
  companies,
  unitsOfMeasure,
  items,
  flexoMachines,
  flexoCylinders,
  diesTooling,
  pantoneColors,
} from "@/db/schema";
import { cacheGetOrSet, invalidateCacheByPrefix } from "@/lib/server/redis";

// Standart kesh saqlash vaqtlari (soniyalarda):
const TTL_UNITS = 86400;      // 24 soat (O'lchov birliklari kam o'zgaradi)
const TTL_PANTONE = 86400;    // 24 soat (Pantone katalogi statik)
const TTL_MACHINES = 43200;   // 12 soat (Stanoklar)
const TTL_CYLINDERS = 43200;  // 12 soat (Silindrlar)
const TTL_TOOLING = 14400;    // 4 soat (Pichoqlar/shtamplar)
const TTL_ITEMS = 3600;       // 1 soat (Nomenklatura & Materiallar)

/**
 * 1. O'lchov birliklarini olish (Redis Cache-Aside)
 */
export async function getUnitsOfMeasure() {
  const cacheKey = "master:units:all";
  return cacheGetOrSet(cacheKey, TTL_UNITS, async () => {
    return db
      .select()
      .from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.isActive, true))
      .orderBy(unitsOfMeasure.code);
  });
}

/**
 * 2. Korxona bo'yicha Xomashyo va Nomenklaturani olish
 */
export async function getItemsByCompany(
  companyCode = "PRINTGOO",
  options?: { category?: string; itemType?: "raw_material" | "semi_finished" | "finished_good" | "service" | "consumable" }
) {
  const cacheKey = `master:items:${companyCode}:${options?.category ?? "all"}:${options?.itemType ?? "all"}`;
  return cacheGetOrSet(cacheKey, TTL_ITEMS, async () => {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.code, companyCode))
      .limit(1);

    if (!company) return [];

    const conditions = [
      eq(items.companyId, company.id),
      eq(items.isActive, true),
    ];

    if (options?.category) {
      conditions.push(eq(items.category, options.category));
    }
    if (options?.itemType) {
      conditions.push(eq(items.itemType, options.itemType));
    }

    return db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        itemType: items.itemType,
        category: items.category,
        description: items.description,
        minStock: items.minStock,
        standardCost: items.standardCost,
        sellingPrice: items.sellingPrice,
        currency: items.currency,
        properties: items.properties,
        unit: {
          id: unitsOfMeasure.id,
          code: unitsOfMeasure.code,
          name: unitsOfMeasure.name,
          shortName: unitsOfMeasure.shortName,
        },
      })
      .from(items)
      .leftJoin(unitsOfMeasure, eq(items.unitId, unitsOfMeasure.id))
      .where(and(...conditions))
      .orderBy(items.code);
  });
}

/**
 * 3. Fleksografik stanoklarni olish (Silindrlari bilan birga)
 */
export async function getFlexoMachinesWithCylinders(companyCode = "PRINTGOO") {
  const cacheKey = `master:machines_full:${companyCode}`;
  return cacheGetOrSet(cacheKey, TTL_MACHINES, async () => {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.code, companyCode))
      .limit(1);

    if (!company) return [];

    const machines = await db
      .select()
      .from(flexoMachines)
      .where(and(eq(flexoMachines.companyId, company.id), eq(flexoMachines.isActive, true)))
      .orderBy(flexoMachines.code);

    const result = [];
    for (const m of machines) {
      const cylinders = await db
        .select()
        .from(flexoCylinders)
        .where(eq(flexoCylinders.machineId, m.id))
        .orderBy(flexoCylinders.teeth);

      result.push({
        ...m,
        minWebWidth: Number(m.minWebWidth),
        maxWebWidth: Number(m.maxWebWidth),
        maxPrintWidth: Number(m.maxPrintWidth),
        standardPlateThickness: Number(m.standardPlateThickness),
        availableCylinders: cylinders.map((c) => ({
          teeth: c.teeth,
          pitchCircleDiameter: Number(c.pitchCircleDiameter),
          plateThickness: Number(c.plateThickness),
          cylinderDiameter: Number(c.cylinderDiameter),
          filmLength: Number(c.filmLength),
          printingLength: Number(c.printingLength),
          needsVerification: c.needsVerification,
          verificationNote: c.verificationNote,
        })),
      });
    }

    return result;
  });
}

/**
 * 4. Pichoqlar va shtamplarni (Dies & Tooling) olish
 */
export async function getDiesTooling(
  companyCode = "PRINTGOO",
  shape?: "rectangle" | "rounded_rect" | "circle" | "oval" | "custom",
  search?: string,
  customerId?: string,
  isDedicated?: boolean
) {
  const cacheKey = `master:tooling:${companyCode}:${shape ?? "all"}:${search ?? "all"}:${customerId ?? "all"}:${isDedicated ?? "all"}`;
  return cacheGetOrSet(cacheKey, TTL_TOOLING, async () => {
    const [company] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.code, companyCode))
      .limit(1);

    if (!company) return [];

    const conditions = [
      eq(diesTooling.companyId, company.id),
      eq(diesTooling.isActive, true),
    ];

    if (shape) {
      conditions.push(eq(diesTooling.shape, shape));
    }

    if (customerId) {
      conditions.push(eq(diesTooling.customerId, customerId));
    }

    if (isDedicated !== undefined) {
      conditions.push(eq(diesTooling.isDedicated, isDedicated));
    }

    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(diesTooling.code, q),
          ilike(diesTooling.name, q),
          ilike(diesTooling.customerName, q),
          ilike(diesTooling.location, q),
          ilike(diesTooling.notes, q)
        )!
      );
    }

    return db
      .select()
      .from(diesTooling)
      .where(and(...conditions))
      .orderBy(diesTooling.code);
  });
}

/**
 * Keyingi mavjud shtamp/pichoq kodini olish (masalan: DIE-0001)
 */
export async function getNextDieCode(companyCode = "PRINTGOO"): Promise<string> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (!company) return "DIE-0001";

  const rows = await db
    .select({ code: diesTooling.code })
    .from(diesTooling)
    .where(eq(diesTooling.companyId, company.id));

  let maxNum = 0;
  for (const r of rows) {
    const match = r.code?.match(/^DIE-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `DIE-${String(maxNum + 1).padStart(4, "0")}`;
}

/**
 * Yangi shtamp/pichoq (Dies & Tooling) yaratish
 */
export async function createDieTooling(data: any, companyCode = "PRINTGOO") {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (!company) {
    throw new Error(`Company with code ${companyCode} not found`);
  }

  const code = (data.code && data.code.trim()) ? data.code.trim().toUpperCase() : await getNextDieCode(companyCode);

  const [inserted] = await db
    .insert(diesTooling)
    .values({
      companyId: company.id,
      code,
      name: data.name || "Yangi Shtamp",
      dieType: data.dieType || "rotary_magnetic",
      shape: data.shape || "rectangle",
      widthMm: String(data.widthMm || 50),
      heightMm: String(data.heightMm || 50),
      cornerRadiusMm: String(data.cornerRadiusMm || 0),
      acrossCount: Number(data.acrossCount) || 1,
      aroundCount: Number(data.aroundCount) || 1,
      gapXMm: String(data.gapXMm ?? 3.0),
      gapYMm: String(data.gapYMm ?? 3.0),
      repeatLengthMm: data.repeatLengthMm !== undefined && data.repeatLengthMm !== null ? String(data.repeatLengthMm) : null,
      cylinderTeeth: data.cylinderTeeth ? Number(data.cylinderTeeth) : null,
      location: data.location || null,
      status: data.status || "available",
      totalImpressions: Number(data.totalImpressions) || 0,
      maxImpressions: data.maxImpressions ? Number(data.maxImpressions) : null,
      notes: data.notes || null,

      customerId: data.customerId || null,
      customerName: data.customerName || null,
      ownership: data.ownership || (data.customerId ? "customer_owned" : "in_house"),
      isDedicated: data.isDedicated !== undefined ? Boolean(data.isDedicated) : Boolean(data.customerId),

      isActive: true,
    })
    .returning();

  await invalidateCacheByPrefix("master:tooling");
  return inserted;
}

/**
 * Mavjud shtamp/pichoqni yangilash (Update)
 */
export async function updateDieTooling(id: string, data: any, companyCode = "PRINTGOO") {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (!company) {
    throw new Error(`Company with code ${companyCode} not found`);
  }

  const updatePayload: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (data.code !== undefined) updatePayload.code = String(data.code).toUpperCase().trim();
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.dieType !== undefined) updatePayload.dieType = data.dieType;
  if (data.shape !== undefined) updatePayload.shape = data.shape;
  if (data.widthMm !== undefined) updatePayload.widthMm = String(data.widthMm);
  if (data.heightMm !== undefined) updatePayload.heightMm = String(data.heightMm);
  if (data.cornerRadiusMm !== undefined) updatePayload.cornerRadiusMm = String(data.cornerRadiusMm);
  if (data.acrossCount !== undefined) updatePayload.acrossCount = Number(data.acrossCount);
  if (data.aroundCount !== undefined) updatePayload.aroundCount = Number(data.aroundCount);
  if (data.gapXMm !== undefined) updatePayload.gapXMm = String(data.gapXMm);
  if (data.gapYMm !== undefined) updatePayload.gapYMm = String(data.gapYMm);
  if (data.repeatLengthMm !== undefined) updatePayload.repeatLengthMm = data.repeatLengthMm ? String(data.repeatLengthMm) : null;
  if (data.cylinderTeeth !== undefined) updatePayload.cylinderTeeth = data.cylinderTeeth ? Number(data.cylinderTeeth) : null;
  if (data.location !== undefined) updatePayload.location = data.location;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.totalImpressions !== undefined) updatePayload.totalImpressions = Number(data.totalImpressions);
  if (data.maxImpressions !== undefined) updatePayload.maxImpressions = data.maxImpressions ? Number(data.maxImpressions) : null;
  if (data.notes !== undefined) updatePayload.notes = data.notes;
  if (data.customerId !== undefined) updatePayload.customerId = data.customerId || null;
  if (data.customerName !== undefined) updatePayload.customerName = data.customerName || null;
  if (data.ownership !== undefined) updatePayload.ownership = data.ownership;
  if (data.isDedicated !== undefined) updatePayload.isDedicated = Boolean(data.isDedicated);
  if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

  const [updated] = await db
    .update(diesTooling)
    .set(updatePayload)
    .where(
      and(
        eq(diesTooling.companyId, company.id),
        or(eq(diesTooling.id, id), eq(diesTooling.code, id))
      )
    )
    .returning();

  await invalidateCacheByPrefix("master:tooling");
  return updated;
}

/**
 * Shtamp/pichoqni o'chirish (Delete)
 */
export async function deleteDieTooling(id: string, companyCode = "PRINTGOO") {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.code, companyCode))
    .limit(1);

  if (!company) return false;

  const [deleted] = await db
    .delete(diesTooling)
    .where(
      and(
        eq(diesTooling.companyId, company.id),
        or(eq(diesTooling.id, id), eq(diesTooling.code, id))
      )
    )
    .returning();

  await invalidateCacheByPrefix("master:tooling");
  return Boolean(deleted);
}

/**
 * 5. Pantone ranglar katalogi (Qidiruv yoki To'liq kesh)
 */
export async function getPantoneCatalog(query?: string, category?: string) {
  if (query && query.trim().length > 0) {
    const q = `%${query.trim()}%`;
    return db
      .select()
      .from(pantoneColors)
      .where(
        and(
          eq(pantoneColors.isActive, true),
          or(
            ilike(pantoneColors.code, q),
            ilike(pantoneColors.name, q),
            ilike(pantoneColors.hex, q)
          )
        )
      )
      .limit(60);
  }

  const cacheKey = `master:pantone:${category ?? "all"}`;
  return cacheGetOrSet(cacheKey, TTL_PANTONE, async () => {
    const conditions = [eq(pantoneColors.isActive, true)];
    if (category) {
      conditions.push(eq(pantoneColors.category, category));
    }
    return db
      .select()
      .from(pantoneColors)
      .where(and(...conditions))
      .orderBy(pantoneColors.code);
  });
}

/**
 * Master Data o'zgarganda keshni tozalash
 */
export async function invalidateMasterCache(companyCode = "PRINTGOO") {
  await Promise.all([
    invalidateCacheByPrefix(`master:items:${companyCode}`),
    invalidateCacheByPrefix(`master:machines_full:${companyCode}`),
    invalidateCacheByPrefix(`master:tooling:${companyCode}`),
  ]);
}
