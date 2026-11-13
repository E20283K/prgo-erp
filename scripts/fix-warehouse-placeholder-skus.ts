/**
 * Qoldiqlar registrida UI vaqtinchalik identifikatori (tab-*, draft-*, new-*) SKU sifatida saqlangan qatorlarni
 * keyingi bo'sh MAT-NNNN raqamiga o'tkazadi (wms_bin_items dagi bog'langan qatorlar bilan birga).
 *
 *   npx tsx scripts/fix-warehouse-placeholder-skus.ts           # faqat ko'rsatish
 *   npx tsx scripts/fix-warehouse-placeholder-skus.ts --apply   # yozish
 */
import "dotenv/config";
import { db, pgClient } from "@/db";
import { warehouseStockBalances, wmsBinItems } from "@/db/schema";
import { and, eq, ilike, or } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

async function main() {
  const bad = await db
    .select()
    .from(warehouseStockBalances)
    .where(
      or(
        ilike(warehouseStockBalances.sku, "tab-%"),
        ilike(warehouseStockBalances.sku, "draft-%"),
        ilike(warehouseStockBalances.sku, "new-%")
      )
    );
  if (bad.length === 0) {
    console.log("Noto'g'ri SKU topilmadi.");
    return;
  }

  // Korxona bo'yicha joriy maksimal MAT raqami
  const maxByCompany = new Map<string, number>();
  const mats = await db
    .select({ companyId: warehouseStockBalances.companyId, sku: warehouseStockBalances.sku })
    .from(warehouseStockBalances)
    .where(ilike(warehouseStockBalances.sku, "MAT-%"));
  for (const m of mats) {
    const n = parseInt(m.sku.replace(/^MAT-/i, ""), 10);
    if (!isNaN(n)) maxByCompany.set(m.companyId, Math.max(maxByCompany.get(m.companyId) || 0, n));
  }

  const rows: Record<string, string>[] = [];
  for (const b of bad) {
    const next = (maxByCompany.get(b.companyId) || 0) + 1;
    maxByCompany.set(b.companyId, next);
    const newSku = `MAT-${String(next).padStart(4, "0")}`;
    rows.push({ location: b.locationName, name: b.name, from: b.sku, to: newSku });
    if (APPLY) {
      await db.transaction(async (tx) => {
        await tx
          .update(wmsBinItems)
          .set({ sku: newSku, updatedAt: new Date() })
          .where(and(eq(wmsBinItems.companyId, b.companyId), eq(wmsBinItems.sku, b.sku)));
        await tx
          .update(warehouseStockBalances)
          .set({ sku: newSku, updatedAt: new Date() })
          .where(eq(warehouseStockBalances.id, b.id));
      });
    }
  }
  console.table(rows);
  console.log(APPLY ? "Yangilandi." : "Dry-run. Yozish uchun --apply bilan ishga tushiring.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
