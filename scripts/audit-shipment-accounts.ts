/**
 * Chiqim qatorlarining hisob kodi (1010 / 2810 / 2910) to'g'riligini tekshirish.
 *
 *   npx tsx scripts/audit-shipment-accounts.ts            # faqat hisobot (dry-run)
 *   npx tsx scripts/audit-shipment-accounts.ts --apply    # Draft/Cancelled chiqimlarda tuzatish
 *
 * Qoida: qator SKU si qaysi registrda mavjud bo'lsa, o'sha hisob to'g'ri.
 *   - 2810 deb belgilangan, lekin FG yo'q va aksessuar katalogida bor  → 2910 (+ tradingCatalogId)
 *   - 2810 deb belgilangan, FG yo'q, xomashyo qoldig'ida bor           → 1010
 * Faqat Draft/Cancelled hujjatlar avtomatik tuzatiladi: band qilingan yoki o'tkazilgan
 * hujjatlarda hisobni almashtirish rezerv/qoldiq yozuvlarini buzadi — ular faqat hisobotda.
 */
import "dotenv/config";
import { db, pgClient } from "@/db";
import {
  warehouseShipments,
  warehouseShipmentItems,
  warehouseFinishedGoods,
  tradingCatalog,
  warehouseStockBalances,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");

interface Finding {
  shipment: string;
  status: string;
  sku: string;
  name: string;
  current: string;
  suggested: string;
  catalogId?: string;
  action: "fixed" | "fixable" | "manual";
}

async function main() {
  const shipments = await db.select().from(warehouseShipments);
  const findings: Finding[] = [];

  for (const shp of shipments) {
    const items = await db.select().from(warehouseShipmentItems).where(eq(warehouseShipmentItems.shipmentId, shp.id));
    for (const it of items) {
      if (it.accountCode !== "2810") continue;

      const fg = await db
        .select({ id: warehouseFinishedGoods.id })
        .from(warehouseFinishedGoods)
        .where(and(eq(warehouseFinishedGoods.companyId, shp.companyId), eq(warehouseFinishedGoods.sku, it.sku)))
        .limit(1);
      if (fg.length > 0) continue;

      const [cat] = await db
        .select({ id: tradingCatalog.id })
        .from(tradingCatalog)
        .where(and(eq(tradingCatalog.companyId, shp.companyId), eq(tradingCatalog.sku, it.sku)))
        .limit(1);
      const [bal] = cat
        ? []
        : await db
            .select({ id: warehouseStockBalances.id })
            .from(warehouseStockBalances)
            .where(and(eq(warehouseStockBalances.companyId, shp.companyId), eq(warehouseStockBalances.sku, it.sku)))
            .limit(1);

      const suggested = cat ? "2910" : bal ? "1010" : "?";
      const editable = shp.status === "Draft" || shp.status === "Cancelled";
      const finding: Finding = {
        shipment: shp.shipmentNumber,
        status: shp.status,
        sku: it.sku,
        name: it.name,
        current: it.accountCode,
        suggested,
        catalogId: cat?.id,
        action: suggested !== "?" && editable ? (APPLY ? "fixed" : "fixable") : "manual",
      };

      if (APPLY && finding.action === "fixed") {
        await db
          .update(warehouseShipmentItems)
          .set({
            accountCode: suggested,
            ...(cat ? { tradingCatalogId: cat.id } : {}),
            updatedAt: new Date(),
          })
          .where(eq(warehouseShipmentItems.id, it.id));
      }
      findings.push(finding);
    }
  }

  if (findings.length === 0) {
    console.log("Barcha 2810 qatorlari tayyor mahsulot registriga mos.");
    return;
  }
  console.table(findings);
  const manual = findings.filter((f) => f.action === "manual");
  console.log(
    `Jami: ${findings.length}. ${APPLY ? "Tuzatildi" : "Avtomatik tuzatish mumkin"}: ${findings.length - manual.length}. Qo'lda ko'rib chiqish: ${manual.length}.`
  );
  if (manual.length > 0) {
    console.log(
      "Qo'lda: o'tkazilgan/band qilingan hujjatlar (avval storno yoki qoralamaga qaytaring) yoki SKU hech bir registrda topilmagan ('?')."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
