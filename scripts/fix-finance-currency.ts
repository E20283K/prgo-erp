/**
 * Bir martalik tuzatish (ilgari mijoz balanslari ro'yxati ochilganda jimgina bajarilardi):
 *
 *  1. So'mda hisob-kitob qiladigan mijozning akti "USD" deb yozilib, summasi kursga
 *     ko'paytirilib ketgan bo'lsa — akt so'mga qaytariladi.
 *  2. Barcha mijozlar balansi (client_settlements) aktlar va to'lovlardan qayta hisoblanadi.
 *
 * Standart holatda hech narsa yozilmaydi, faqat ro'yxat chiqadi:
 *
 *   npx tsx scripts/fix-finance-currency.ts            # ko'rib chiqish
 *   npx tsx scripts/fix-finance-currency.ts --apply    # bazaga yozish
 */
import "dotenv/config";
import { db, pgClient } from "@/db";
import { deliveryActs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncClientSettlement } from "@/lib/server/financeService";

const APPLY = process.argv.includes("--apply");

async function main() {
  const allClients = await db.query.clients.findMany();
  const clientById = new Map(allClients.map((c) => [c.id, c]));
  const acts = await db.query.deliveryActs.findMany();

  // 1. USD deb yozilgan so'm aktlari
  const mistaken = acts.filter((a) => {
    const client = clientById.get(a.clientId);
    const rate = Number(a.exchangeRate) || 12850;
    const usd = Number(a.totalAmountUsd) || 0;
    const uzs = Number(a.totalAmountUzs) || 0;
    return (
      (client?.currency || "UZS").toUpperCase() === "UZS" &&
      (a.currency || "USD").toUpperCase() === "USD" &&
      usd >= 100_000 &&
      Math.abs(uzs - Math.round(usd * rate)) <= 5
    );
  });

  console.log(`USD deb yozilgan so'm aktlari: ${mistaken.length}`);
  for (const a of mistaken) {
    console.log(`  ${a.docNo}  ${a.clientName}  ${Number(a.totalAmountUsd).toLocaleString()} "USD" → UZS`);
  }

  // 2. Balansi aktlar/to'lovlarga mos kelmaydigan mijozlar
  const settlements = await db.query.clientSettlements.findMany();
  console.log(`\nMijoz balanslari: ${settlements.length} ta qayta hisoblanadi`);

  if (!APPLY) {
    console.log("\nHech narsa yozilmadi. Yozish uchun: --apply");
    return;
  }

  await db.transaction(async (tx) => {
    for (const a of mistaken) {
      const rate = Number(a.exchangeRate) || 12850;
      const uzs = Number(a.totalAmountUsd) || 0;
      const vatRate = Number(a.vatRate) || 0;
      const subUzs = Number((uzs / (1 + vatRate / 100)).toFixed(2));
      const vatUzs = Number((uzs - subUzs).toFixed(2));
      const toUsd = (v: number) => (Math.round((v / rate) * 100) / 100).toString();
      await tx
        .update(deliveryActs)
        .set({
          currency: "UZS",
          totalAmountUzs: uzs.toString(),
          totalAmountUsd: toUsd(uzs),
          subtotalUzs: subUzs.toString(),
          subtotalUsd: toUsd(subUzs),
          vatAmountUzs: vatUzs.toString(),
          vatAmountUsd: toUsd(vatUzs),
          updatedAt: new Date(),
        })
        .where(eq(deliveryActs.id, a.id));
    }
    for (const s of settlements) {
      const client = clientById.get(s.clientId);
      await syncClientSettlement(s.companyId, s.clientId, client?.name || s.customer, client?.tin || undefined, undefined, tx);
    }
  });
  console.log(`\nYozildi: ${mistaken.length} akt tuzatildi, ${settlements.length} balans qayta hisoblandi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pgClient.end());
