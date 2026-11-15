import { db } from "@/db";
import { productTypes } from "@/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

export interface ProductTypeRecord {
  id: string;
  name: string;
}

/** Faol mahsulot turlari, alifbo tartibida. */
export async function getProductTypes(companyCode: string = "PRINTGOO"): Promise<ProductTypeRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);
  return db
    .select({ id: productTypes.id, name: productTypes.name })
    .from(productTypes)
    .where(and(eq(productTypes.companyId, companyId), eq(productTypes.isActive, true)))
    .orderBy(asc(productTypes.name));
}

/**
 * Yangi tur yaratadi. Shu nom (katta-kichik harfdan qat'i nazar) allaqachon bo'lsa,
 * dublikat ochmasdan mavjudini qaytaradi — hisobotda bir tur ikki xil yozilmasligi uchun.
 */
export async function createProductType(
  rawName: string,
  companyCode: string = "PRINTGOO"
): Promise<ProductTypeRecord> {
  const name = rawName.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Tur nomi kiritilishi shart");
  if (name.length > 128) throw new Error("Tur nomi 128 belgidan oshmasligi kerak");

  const companyId = await getCompanyIdByCode(companyCode);

  const [existing] = await db
    .select({ id: productTypes.id, name: productTypes.name, isActive: productTypes.isActive })
    .from(productTypes)
    .where(and(eq(productTypes.companyId, companyId), sql`lower(${productTypes.name}) = lower(${name})`))
    .limit(1);

  if (existing) {
    if (!existing.isActive) {
      await db.update(productTypes).set({ isActive: true }).where(eq(productTypes.id, existing.id));
    }
    return { id: existing.id, name: existing.name };
  }

  const [created] = await db
    .insert(productTypes)
    .values({ companyId, name })
    .returning({ id: productTypes.id, name: productTypes.name });
  return created;
}
