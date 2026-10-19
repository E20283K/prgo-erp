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
  shape?: "rectangle" | "rounded_rect" | "circle" | "oval" | "custom"
) {
  const cacheKey = `master:tooling:${companyCode}:${shape ?? "all"}`;
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

    return db
      .select()
      .from(diesTooling)
      .where(and(...conditions))
      .orderBy(diesTooling.code);
  });
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
