/**
 * Ombor chiqimidan avtomatik yaratilgan, QQS 0 bilan yozilgan schet-fakturalarni qayta hisoblash.
 *
 *   npx tsx scripts/fix-shipment-invoice-vat.ts            # faqat hisobot (dry-run)
 *   npx tsx scripts/fix-shipment-invoice-vat.ts --apply    # imzolanmagan SF'larni tuzatish
 *
 * Buyurtma narxi QQS ichida (bfbe048 bilan bir xil qoida): SF jami summasi va mijoz qarzi
 * o'zgarmaydi, QQS jami ichidan ajratiladi, qatorlar QQSsiz narxda saqlanadi.
 *
 * Qamrov: chiqimga bog'langan (yoki chiqim izohi bor), bekor qilinmagan, QQS summasi 0 bo'lgan
 * SF'lar. Stavka kompaniyaga moslanadi: QQS to'lovchida u jami ichidan ajratiladi, to'lovchi
 * bo'lmaganda stavka 0 qilinadi (summalar o'zgarmaydi). Imzolangan SF yuridik hujjat — u faqat
 * hisobotda ko'rsatiladi, tuzatish uchun tuzatuvchi SF rasmiylashtiriladi.
 */
import "dotenv/config";
import { db, pgClient, writeAuditLog } from "@/db";
import { deliveryActs, deliveryActItems } from "@/db/schema";
import { eq, ne } from "drizzle-orm";
import { getCompanyVatRate } from "@/lib/server/financeService";

const APPLY = process.argv.includes("--apply");

const r2 = (n: number) => Number(n.toFixed(2));
const r4 = (n: number) => Number(n.toFixed(4));

interface Finding {
  docNo: string;
  status: string;
  currency: string;
  total: number;
  rate: number;
  subtotal: number;
  vat: number;
  items: number;
  action: "fixed" | "fixable" | "signed";
}

async function main() {
  const acts = await db.select().from(deliveryActs).where(ne(deliveryActs.status, "cancelled"));

  const rateByCompany = new Map<string, number>();
  const findings: Finding[] = [];

  for (const act of acts) {
    const fromShipment = Boolean(act.linkedShipmentId) || (act.notes || "").includes("Ombor chiqimi");
    if (!fromShipment) continue;
    if (Number(act.vatAmountUsd) !== 0 || Number(act.vatAmountUzs) !== 0) continue;

    if (!rateByCompany.has(act.companyId)) rateByCompany.set(act.companyId, await getCompanyVatRate(db, act.companyId));
    const rate = rateByCompany.get(act.companyId)!;
    const items = await db.select().from(deliveryActItems).where(eq(deliveryActItems.actId, act.id));
    // Already right: the stated rate matches the company's and, being 0, needs no VAT amount.
    const consistent = rate === 0 && Number(act.vatRate) === 0 && items.every((it) => Number(it.vatRate) === 0);
    if (consistent) continue;

    const f = 1 + rate / 100;
    const totalUsd = Number(act.totalAmountUsd);
    const totalUzs = Number(act.totalAmountUzs);
    const subUsd = r2(totalUsd / f);
    const subUzs = r2(totalUzs / f);
    const isUsd = (act.currency || "UZS").toUpperCase() === "USD";

    const finding: Finding = {
      docNo: act.docNo,
      status: act.status,
      currency: act.currency,
      total: isUsd ? totalUsd : totalUzs,
      rate,
      subtotal: isUsd ? subUsd : subUzs,
      vat: isUsd ? r2(totalUsd - subUsd) : r2(totalUzs - subUzs),
      items: items.length,
      action: act.status === "signed" ? "signed" : "fixable",
    };

    if (APPLY && finding.action === "fixable") {
      await db.transaction(async (tx) => {
        await tx
          .update(deliveryActs)
          .set({
            vatRate: rate.toFixed(2),
            subtotalUsd: subUsd.toString(),
            subtotalUzs: subUzs.toString(),
            vatAmountUsd: r2(totalUsd - subUsd).toString(),
            vatAmountUzs: r2(totalUzs - subUzs).toString(),
            updatedAt: new Date(),
          })
          .where(eq(deliveryActs.id, act.id));
        for (const it of items) {
          await tx
            .update(deliveryActItems)
            .set({
              vatRate: rate.toFixed(2),
              unitPriceUsd: r4(Number(it.unitPriceUsd) / f).toString(),
              unitPriceUzs: r2(Number(it.unitPriceUzs) / f).toString(),
              totalUsd: r2(Number(it.totalUsd) / f).toString(),
              totalUzs: r2(Number(it.totalUzs) / f).toString(),
            })
            .where(eq(deliveryActItems.id, it.id));
        }
        await writeAuditLog(
          {
            companyId: act.companyId,
            userId: "system",
            userName: "fix-shipment-invoice-vat",
            entityType: "delivery_act",
            entityId: act.id,
            action: "update",
            oldData: { vatRate: Number(act.vatRate), subtotalUsd: Number(act.subtotalUsd), subtotalUzs: Number(act.subtotalUzs) },
            newData: { vatRate: rate, subtotalUsd: subUsd, subtotalUzs: subUzs },
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tx as any
        );
      });
      finding.action = "fixed";
    }
    findings.push(finding);
  }

  console.log(APPLY ? "Rejim: --apply" : "Rejim: dry-run (o'zgarish yozilmaydi)");
  console.log(`QQS 0 bo'lgan chiqim SF'lari: ${findings.length}`);
  for (const f of findings) {
    console.log(
      `  ${f.docNo.padEnd(14)} ${f.status.padEnd(18)} ${f.currency} jami ${f.total.toLocaleString("en-US")}  ` +
        `→ QQSsiz ${f.subtotal.toLocaleString("en-US")} + QQS ${f.rate}% ${f.vat.toLocaleString("en-US")}  ` +
        `(${f.items} qator)  [${f.action}]`
    );
  }
  const signed = findings.filter((f) => f.action === "signed").length;
  const fixable = findings.filter((f) => f.action === "fixable").length;
  const fixed = findings.filter((f) => f.action === "fixed").length;
  console.log(`\nTuzatildi: ${fixed} · Tuzatish mumkin: ${fixable} · Imzolangan (qo'lda, tuzatuvchi SF): ${signed}`);
  if (!APPLY && fixable > 0) console.log("Qo'llash uchun: npx tsx scripts/fix-shipment-invoice-vat.ts --apply");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgClient.end();
  });
