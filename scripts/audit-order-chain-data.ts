/**
 * Buyurtma zanjiri auditi: bazadagi mavjud ma'lumotlarda topilgan xatolarning real ta'siri.
 * Faqat o'qiydi, hech narsa yozmaydi.
 *
 *   npx tsx scripts/audit-order-chain-data.ts
 */
import "dotenv/config";
import { db, pgClient } from "@/db";

async function main() {
  const fg = await db.query.warehouseFinishedGoods.findMany();
  const orders = await db.query.workOrders.findMany({
    columns: { docNo: true, priceTotal: true, quantity: true, currency: true, clientId: true, status: true },
  });
  const orderByNo = new Map(orders.map((o) => [o.docNo, o]));
  const saleOf = (no: string | null) => {
    const o = no ? orderByNo.get(no) : undefined;
    const q = Number(o?.quantity) || 0;
    return o && q > 0 ? (Number(o.priceTotal) || 0) / q : 0;
  };

  // A1: jo'natilgan qatorlar — narxi tayyor mahsulot tannarxiga teng, sotuv narxidan farq qiladi
  const shipments = await db.query.warehouseShipments.findMany({ with: { items: true } });
  const fgById = new Map(fg.map((f) => [f.id, f]));
  let atCost = 0;
  let zeroPrice = 0;
  const atCostRows: string[] = [];
  for (const s of shipments) {
    if (!["Dispatched", "In Transit", "Delivered"].includes(s.status)) continue;
    for (const it of s.items) {
      const f = it.finishedGoodId ? fgById.get(it.finishedGoodId) : undefined;
      if (!f) continue;
      const price = Number(it.unitPrice) || 0;
      const cost = Number(f.costPricePerUnit) || 0;
      const sale = saleOf(f.workOrderId);
      if (price === 0) zeroPrice++;
      else if (cost > 0 && sale > 0 && Math.abs(price - cost) < 0.01 && Math.abs(price - sale) > 0.01) {
        atCost++;
        atCostRows.push(
          `  ${s.shipmentNumber}  ${it.sku}  narx ${price} (tannarx ${cost}, sotuv ${sale.toFixed(4)})  × ${Number(it.quantity)}`
        );
      }
    }
  }
  console.log(`A1  tannarx bo'yicha jo'natilgan qatorlar: ${atCost}`);
  atCostRows.slice(0, 20).forEach((r) => console.log(r));
  console.log(`A1  narxi 0 bo'lgan jo'natilgan qatorlar: ${zeroPrice}`);

  // A2: USD buyurtmaga UZS akt
  const acts = await db.query.deliveryActs.findMany({ with: { workOrder: true } });
  const wrongCurrency = acts.filter(
    (a) => a.status !== "cancelled" && a.workOrder && (a.workOrder.currency || "UZS") !== (a.currency || "UZS")
  );
  console.log(`A2  valyutasi buyurtmanikidan farq qiladigan aktlar: ${wrongCurrency.length}`);
  wrongCurrency.slice(0, 20).forEach((a) => console.log(`  ${a.docNo}  akt ${a.currency}, buyurtma ${a.workOrder?.currency}`));

  // A3: QQS summasi 0, stavkasi 12
  const vatMismatch = acts.filter((a) => Number(a.vatRate) > 0 && Number(a.vatAmountUzs) === 0 && Number(a.totalAmountUzs) > 0);
  console.log(`A3  QQS stavkasi > 0, summasi 0 bo'lgan aktlar: ${vatMismatch.length}`);

  // B3: bir xil nomli mijozlar (dublikat)
  const clients = await db.query.clients.findMany({ columns: { id: true, name: true, code: true, companyId: true } });
  const byName = new Map<string, string[]>();
  for (const c of clients) {
    const k = `${c.companyId}|${c.name.trim().toLowerCase()}`;
    byName.set(k, [...(byName.get(k) || []), c.code]);
  }
  const dups = [...byName.entries()].filter(([, v]) => v.length > 1);
  console.log(`B3  nomi takrorlangan mijozlar: ${dups.length}`);
  dups.slice(0, 20).forEach(([k, v]) => console.log(`  ${k.split("|")[1]}: ${v.join(", ")}`));

  const noClient = orders.filter((o) => !o.clientId && o.status !== "Cancelled");
  console.log(`B3  mijozga bog'lanmagan buyurtmalar: ${noClient.length} / ${orders.length}`);

  // B2: ishbay yozuvlari mavjud bo'lmagan buyurtmaga
  const pw = await db.query.pieceworkLogs.findMany({ columns: { workOrderId: true, status: true } });
  const orphanPw = pw.filter((p) => !orderByNo.has(p.workOrderId));
  console.log(`B2  mavjud bo'lmagan buyurtmaga yozilgan ishbay: ${orphanPw.length} / ${pw.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
