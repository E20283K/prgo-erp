/**
 * Eski chiqimlarda delivery_act_id ustunida SF raqami (SF-YY-NNNN) o'rniga akt UUID si saqlangan.
 * UI aktni docNo bo'yicha qidiradi — shuning uchun jadvalda UUID ko'rinadi va SF tugmasi ishlamaydi.
 * Skript UUID ni docNo ga almashtiradi va delivery_acts.linked_shipment_id ni to'ldiradi.
 *
 *   npx tsx scripts/fix-shipment-delivery-act-ids.ts           # faqat ko'rsatish
 *   npx tsx scripts/fix-shipment-delivery-act-ids.ts --apply   # yozish
 */
import "dotenv/config";
import { db, pgClient } from "@/db";
import { warehouseShipments, deliveryActs } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";

const APPLY = process.argv.includes("--apply");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main() {
  const shipments = await db.select().from(warehouseShipments);
  const rows: Record<string, string>[] = [];

  for (const shp of shipments) {
    const key = shp.deliveryActId;
    if (!key || !UUID_RE.test(key)) continue;

    const [act] = await db
      .select()
      .from(deliveryActs)
      .where(and(eq(deliveryActs.companyId, shp.companyId), eq(deliveryActs.id, key)))
      .limit(1);
    if (!act) {
      rows.push({ shipment: shp.shipmentNumber, from: key, to: "(akt topilmadi — o'zgartirilmaydi)" });
      continue;
    }

    rows.push({ shipment: shp.shipmentNumber, from: key, to: act.docNo });
    if (APPLY) {
      await db.transaction(async (tx) => {
        await tx
          .update(warehouseShipments)
          .set({ deliveryActId: act.docNo, updatedAt: new Date() })
          .where(eq(warehouseShipments.id, shp.id));
        await tx
          .update(deliveryActs)
          .set({ linkedShipmentId: shp.id, updatedAt: new Date() })
          .where(and(eq(deliveryActs.id, act.id), isNull(deliveryActs.linkedShipmentId)));
      });
    }
  }

  if (rows.length === 0) {
    console.log("UUID saqlangan chiqim topilmadi.");
    return;
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
