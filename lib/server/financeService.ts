import { db, type DbExec } from "@/db";
import {
  deliveryActs,
  deliveryActItems,
  clientSettlements,
  clientPayments,
  bankAccounts,
  companies,
  clients,
  workOrders,
} from "@/db/schema";
import { eq, desc, and, sql, ilike } from "drizzle-orm";
import { getCompanyIdByCode, resolveClient, unknownClientMessage } from "./crmService";
import { getNextDeliveryActNumber, calculateNextNumber, getCurrentYearSuffix, lockNumbering } from "./numberingService";
import { emitNotification } from "./notificationService";
import type { DeliveryActRecord, ClientSettlementRecord } from "@/store/workspaceStore";

const FALLBACK_USD_RATE = 12850;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** UZS per USD for documents that carry no rate: the company's setting, else the built-in fallback. */
function companyExchangeRate(company: { settings?: { exchangeRateUsd?: number } | null } | null | undefined): number {
  const r = Number(company?.settings?.exchangeRateUsd);
  return Number.isFinite(r) && r > 0 ? r : FALLBACK_USD_RATE;
}

/** UZS per USD the company works with (settings.exchangeRateUsd, else the built-in fallback). */
export async function getCompanyExchangeRate(exec: DbExec, companyId: string): Promise<number> {
  const company = await exec.query.companies.findFirst({ where: eq(companies.id, companyId) });
  return companyExchangeRate(company);
}

// ─── 1. Delivery Acts ──────────────────────────────────────────────────────────

export async function getDeliveryActs(companyCode: string = "PRINTGOO"): Promise<DeliveryActRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawActs = await db.query.deliveryActs.findMany({
    where: eq(deliveryActs.companyId, companyId),
    with: {
      items: {
        orderBy: (items, { asc }) => [asc(items.sortOrder)],
      },
      client: true,
      workOrder: true,
    },
    orderBy: [desc(deliveryActs.createdAt)],
  });

  return rawActs.map((act) => {
    const firstItem = act.items[0];
    const statusMap: Record<string, DeliveryActRecord["status"]> = {
      draft: "Draft",
      pending_signature: "Pending Signature",
      signed: "Signed & Stamped",
      disputed: "Disputed",
      cancelled: "Cancelled",
    };

    const clientCurr = (act.client?.currency || act.currency || "UZS").toUpperCase();
    const rawUsd = Number(act.totalAmountUsd) || 0;
    const rawUzs = Number(act.totalAmountUzs) || 0;
    // Detect if a UZS amount (e.g. 10,000,000 / 9,999,999.52) was mistakenly saved as USD and multiplied by exchangeRate
    const isMistakenlyMultipliedUzs =
      clientCurr === "UZS" &&
      rawUsd >= 100_000 &&
      rawUzs > rawUsd * 1000;

    const effectiveCurrency = isMistakenlyMultipliedUzs ? "UZS" : (act.currency || clientCurr || "UZS").toUpperCase();
    const isActUzs = effectiveCurrency === "UZS";

    const snapRounding = (val: number) => {
      const nearestThousand = Math.round(val / 1000) * 1000;
      return nearestThousand > 0 && Math.abs(nearestThousand - val) < 1 ? nearestThousand : val;
    };

    const resolvedTotal = isMistakenlyMultipliedUzs
      ? snapRounding(rawUsd)
      : isActUzs
      ? snapRounding(rawUzs || rawUsd || 0)
      : rawUsd || rawUzs || 0;

    const resolvedSubtotal = isMistakenlyMultipliedUzs
      ? Number(act.subtotalUsd) || 0
      : isActUzs
      ? Number(act.subtotalUzs) || Number(act.subtotalUsd) || 0
      : Number(act.subtotalUsd) || Number(act.subtotalUzs) || 0;

    const resolvedVat = isMistakenlyMultipliedUzs
      ? Number(act.vatAmountUsd) || 0
      : isActUzs
      ? Number(act.vatAmountUzs) || Number(act.vatAmountUsd) || 0
      : Number(act.vatAmountUsd) || Number(act.vatAmountUzs) || 0;

    return {
      id: act.docNo || act.id,
      date: act.date,
      orderId: act.docNo,
      workOrderId: (act as any).workOrder?.docNo || act.workOrderId || "",
      contractNo: act.contractNo || "",
      customer: act.clientName || act.client?.name || "",
      customerTin: act.clientTin || act.client?.tin || "",
      product: firstItem ? firstItem.name : "Bosma mahsulotlar",
      quantity: firstItem ? Number(firstItem.quantity) : 0,
      unit: firstItem ? firstItem.unit : "dona",
      subtotal: resolvedSubtotal,
      vatRate: act.vatRate === null || act.vatRate === undefined ? 12 : Number(act.vatRate),
      vatAmount: resolvedVat,
      totalAmount: resolvedTotal,
      currency: effectiveCurrency,
      warehouse: act.warehouse || "Asosiy Ombor (Tayyor Mahsulot)",
      carrier: act.carrier || "",
      driverName: act.driverName || "",
      recipientName: act.recipientName || "",
      status: statusMap[act.status] || "Draft",
      linkedShipmentId: act.linkedShipmentId || undefined,
      notes: act.notes || undefined,
      items: act.items.map((it) => ({
        id: it.id,
        sku: it.sku || "",
        name: it.name,
        size: it.size || undefined,
        unit: it.unit,
        quantity: Number(it.quantity),
        unitPrice: isMistakenlyMultipliedUzs
          ? Number(it.unitPriceUsd) || 0
          : isActUzs
          ? Number(it.unitPriceUzs) || Number(it.unitPriceUsd) || 0
          : Number(it.unitPriceUsd) || Number(it.unitPriceUzs) || 0,
        vatRate: it.vatRate === null || it.vatRate === undefined ? 12 : Number(it.vatRate),
      })),
    };
  });
}

export interface DeliveryActWriteOptions {
  /** Tranzaksiya ichida chaqirilganda tx; aks holda db */
  exec?: DbExec;
  /** Berilsa, tashqi effektlar (bildirishnoma) tranzaksiya commit bo'lgandan keyin bajariladi */
  afterCommit?: Array<() => Promise<void>>;
}

export async function upsertDeliveryAct(
  data: Partial<DeliveryActRecord> & {
    clientTin?: string;
    exchangeRate?: number;
    clientId?: string | null;
    /** warehouse_shipments.id (UUID) — delivery_acts.linked_shipment_id FK uchun */
    linkedShipmentUuid?: string | null;
  },
  companyCode: string = "PRINTGOO",
  opts: DeliveryActWriteOptions = {}
) {
  // Called on its own (the finance screen) it opens its own transaction, so the act, its lines and
  // the client's balance are written together and its number is taken under the series lock.
  if (!opts.exec) {
    const afterCommit: Array<() => Promise<void>> = [];
    const result: { success: boolean; docNo: string; id: string } = await db.transaction((tx) =>
      upsertDeliveryAct(data, companyCode, { exec: tx, afterCommit })
    );
    for (const fn of afterCommit) {
      try {
        await fn();
      } catch {
        // a notification that fails does not undo a saved act
      }
    }
    return result;
  }
  const exec = opts.exec;
  const companyId = await getCompanyIdByCode(companyCode);
  const linkedShipmentUuid =
    data.linkedShipmentUuid && /^[0-9a-f-]{36}$/i.test(data.linkedShipmentUuid) ? data.linkedShipmentUuid : null;

  // 1. Mijoz: ID, INN yoki nomi bo'yicha. Topilmasa akt yozilmaydi (yon tomondan mijoz yaratilmaydi).
  const tinToSearch = data.customerTin?.trim();
  const client = await resolveClient(exec, companyId, { id: data.clientId, tin: tinToSearch, name: data.customer });
  if (!client) throw new Error(unknownClientMessage(data.customer));
  const targetClientId = client.id;
  const clientDefaultCurrency = client.currency || "UZS";

  const hasOwnNumber = Boolean(data.id?.startsWith("ACT-") || data.id?.startsWith("SF-"));
  if (!hasOwnNumber) await lockNumbering(exec, companyId, "SF");
  const docNo = hasOwnNumber ? data.id! : await getNextDeliveryActNumber(companyCode, exec);

  // VAT: what the document says (0 included); only a missing rate falls back to the company's.
  const company = await exec.query.companies.findFirst({ where: eq(companies.id, companyId) });
  const defaultVatRate = company?.isVatPayer === false ? 0 : Number(company?.settings?.defaultTaxPercent ?? 12);
  const vatRateOf = (v: unknown) => {
    const n = v === undefined || v === null || v === "" ? NaN : Number(v);
    return Number.isFinite(n) && n >= 0 ? n : defaultVatRate;
  };
  const actVatRate = vatRateOf(data.vatRate);
  const date = data.date || new Date().toISOString().split("T")[0];

  const dbStatusMap: Record<string, "draft" | "pending_signature" | "signed" | "disputed" | "cancelled"> = {
    Draft: "draft",
    "Pending Signature": "pending_signature",
    "Signed & Stamped": "signed",
    Disputed: "disputed",
    Cancelled: "cancelled",
  };

  const status = data.status ? dbStatusMap[data.status] || "draft" : "draft";
  const rate = Number(data.exchangeRate) || companyExchangeRate(company);
  const snapRounding = (val: number) => {
    const nearestThousand = Math.round(val / 1000) * 1000;
    return nearestThousand > 0 && Math.abs(val - nearestThousand) < 1.5 ? nearestThousand : val;
  };
  const total = snapRounding(Number(data.totalAmount) || 0);
  const subtotal = Number(data.subtotal) || 0;
  const vatAmount = Number((total - subtotal).toFixed(2));

  // Agar mijoz valyutasi UZS bo'lsa va summa >= 100,000 bo'lsa, uni USD deb kursga ko'paytirib yubormaslik
  const rawCurr = (data.currency || clientDefaultCurrency || "UZS").toUpperCase();
  const effectiveCurr =
    clientDefaultCurrency.toUpperCase() === "UZS" && rawCurr === "USD" && total >= 100_000
      ? "UZS"
      : rawCurr;
  const isUsd = effectiveCurr === "USD";

  const totalUsd = isUsd ? total : Math.round((total / rate) * 100) / 100;
  const totalUzs = isUsd ? Math.round(total * rate) : total;
  const subtotalUsd = isUsd ? subtotal : Math.round((subtotal / rate) * 100) / 100;
  const subtotalUzs = isUsd ? Math.round(subtotal * rate) : subtotal;
  const vatUsd = isUsd ? vatAmount : Math.round((vatAmount / rate) * 100) / 100;
  const vatUzs = isUsd ? Math.round(vatAmount * rate) : vatAmount;

  // Mavjud akt bormi?
  const existingAct = await exec.query.deliveryActs.findFirst({
    where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.docNo, docNo)),
  });

  // WorkOrder ID ni (docNo yoki UUID orqali) aniqlash
  let targetWorkOrderId: string | null = null;
  if (data.workOrderId) {
    const woKey = data.workOrderId.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(woKey);
    const foundWo = await exec.query.workOrders.findFirst({
      where: and(
        eq(workOrders.companyId, companyId),
        isUuid ? eq(workOrders.id, woKey) : eq(workOrders.docNo, woKey)
      ),
    });
    if (foundWo) {
      targetWorkOrderId = foundWo.id;
    }
  }

  if (existingAct && !hasOwnNumber) {
    // A freshly issued number must never land on somebody else's act.
    throw new Error(`${docNo} raqamli schet-faktura allaqachon mavjud. Qayta urinib ko'ring.`);
  }

  let actId: string;

  if (existingAct) {
    actId = existingAct.id;
    await exec
      .update(deliveryActs)
      .set({
        date,
        clientId: targetClientId,
        clientName: data.customer || existingAct.clientName,
        clientTin: data.customerTin || existingAct.clientTin,
        contractNo: data.contractNo || existingAct.contractNo,
        workOrderId: targetWorkOrderId ?? existingAct.workOrderId,
        carrier: data.carrier || existingAct.carrier,
        driverName: data.driverName || existingAct.driverName,
        recipientName: data.recipientName || existingAct.recipientName,
        subtotalUsd: subtotalUsd.toString(),
        subtotalUzs: subtotalUzs.toString(),
        exchangeRate: rate.toString(),
        vatRate: actVatRate.toString(),
        vatAmountUsd: vatUsd.toString(),
        vatAmountUzs: vatUzs.toString(),
        totalAmountUsd: totalUsd.toString(),
        totalAmountUzs: totalUzs.toString(),
        currency: effectiveCurr,
        warehouse: data.warehouse || existingAct.warehouse,
        status,
        ...(linkedShipmentUuid ? { linkedShipmentId: linkedShipmentUuid } : {}),
        notes: data.notes || existingAct.notes,
        updatedAt: new Date(),
      })
      .where(eq(deliveryActs.id, actId));

    // Eski itemlarni tozalab yangilarini qo'shamiz
    await exec.delete(deliveryActItems).where(eq(deliveryActItems.actId, actId));
  } else {
    const [created] = await exec
      .insert(deliveryActs)
      .values({
        companyId,
        docNo,
        date,
        clientId: targetClientId,
        clientName: data.customer || "Noma'lum Mijoz",
        clientTin: data.customerTin || null,
        contractNo: data.contractNo || null,
        workOrderId: targetWorkOrderId,
        carrier: data.carrier || null,
        driverName: data.driverName || null,
        recipientName: data.recipientName || null,
        subtotalUsd: subtotalUsd.toString(),
        subtotalUzs: subtotalUzs.toString(),
        exchangeRate: rate.toString(),
        vatRate: actVatRate.toString(),
        vatAmountUsd: vatUsd.toString(),
        vatAmountUzs: vatUzs.toString(),
        totalAmountUsd: totalUsd.toString(),
        totalAmountUzs: totalUzs.toString(),
        currency: effectiveCurr,
        warehouse: data.warehouse || "Asosiy Ombor (Tayyor Mahsulot)",
        status,
        linkedShipmentId: linkedShipmentUuid,
        notes: data.notes || null,
      })
      .returning();
    actId = created.id;
  }

  // Items qo'shish
  if (data.items && data.items.length > 0) {
    const itemRows = data.items.map((it, idx) => {
      const q = Number(it.quantity) || 1;
      const p = Number(it.unitPrice) || 0;
      const t = q * p;
      return {
        actId,
        sku: it.sku || `ITEM-${idx + 1}`,
        name: it.name || "Bosma mahsulot",
        size: it.size || null,
        unit: it.unit || "dona",
        quantity: q.toString(),
        unitPriceUsd: (isUsd ? p : p / rate).toString(),
        unitPriceUzs: (isUsd ? p * rate : p).toString(),
        totalUsd: (isUsd ? t : t / rate).toString(),
        totalUzs: (isUsd ? t * rate : t).toString(),
        vatRate: vatRateOf(it.vatRate ?? actVatRate).toString(),
        sortOrder: idx,
      };
    });
    await exec.insert(deliveryActItems).values(itemRows);
  }

  // 2. Client Settlements (Mijoz balansi)ni avtomatik yangilash
  await syncClientSettlement(companyId, targetClientId, data.customer || "", data.customerTin, data.contractNo, exec);

  // 3. Bildirishnoma triggeri (Schet-faktura rasmiylashtirildi) — tranzaksiyada bo'lsa commit'dan keyin
  const notify = async () => {
    await emitNotification(
      {
        dedupKey: `delivery-act:${docNo}`,
        severity: "success",
        category: "finance",
        eventType: "invoice_posted",
        entityCode: docNo,
        title: `Schet-faktura ${docNo} rasmiylashtirildi`,
        description: `${data.customer || "Mijoz"} — $${totalUsd.toLocaleString()} (${data.status || "Signed & Stamped"}).`,
        link: { module: "finance", subModule: "delivery-acts" },
        targetTab: {
          id: `doc-delivery-act-${docNo}`,
          title: `${docNo} (Schet-faktura)`,
          type: "delivery-act",
          module: "finance",
        },
      },
      companyCode
    );
  };
  if (opts.afterCommit) {
    opts.afterCommit.push(notify);
  } else {
    try {
      await notify();
    } catch (_) {}
  }

  return { success: true, docNo, id: actId };
}

/**
 * Schet-fakturani bekor qilish (ombor chiqimi stornosi).
 * Imzolangan aktni bekor qilib bo'lmaydi — bunday holatda qaytarish hujjati kerak.
 * Mijoz balansi qayta hisoblanadi (bekor qilingan aktlar qarzga kirmaydi).
 */
export async function cancelDeliveryAct(
  companyId: string,
  docNo: string,
  exec: DbExec = db
): Promise<{ cancelled: boolean; reason?: string }> {
  const act = await exec.query.deliveryActs.findFirst({
    where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.docNo, docNo)),
  });
  if (!act) return { cancelled: false, reason: "not_found" };
  if (act.status === "cancelled") return { cancelled: true };
  if (act.status === "signed") {
    throw new Error(
      `${docNo} schet-fakturasi mijoz tomonidan imzolangan. Storno uchun qaytarish (vozvrat) hujjatini rasmiylashtiring.`
    );
  }
  await exec
    .update(deliveryActs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(deliveryActs.id, act.id));
  if (act.clientId) {
    await syncClientSettlement(companyId, act.clientId, act.clientName || "", act.clientTin || undefined, act.contractNo || undefined, exec);
  }
  return { cancelled: true };
}

// ─── 2. Settlements Synchronization ────────────────────────────────────────────

export async function syncClientSettlement(
  companyId: string,
  clientId: string,
  customerName: string,
  customerTin?: string,
  contractNo?: string,
  exec: DbExec = db
) {
  // Debit: every act that is not cancelled. Credit: every payment that is not cancelled.
  const acts = (
    await exec.query.deliveryActs.findMany({
      where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.clientId, clientId)),
    })
  ).filter((a) => a.status !== "cancelled");

  const payments = (
    await exec.query.clientPayments.findMany({
      where: and(eq(clientPayments.companyId, companyId), eq(clientPayments.clientId, clientId)),
    })
  ).filter((p) => p.status !== "cancelled");

  const [client, existingSettlement] = await Promise.all([
    exec.query.clients.findFirst({ where: eq(clients.id, clientId) }),
    exec.query.clientSettlements.findFirst({
      where: and(eq(clientSettlements.companyId, companyId), eq(clientSettlements.clientId, clientId)),
    }),
  ]);

  const totalDebitUsd = acts.reduce((sum, a) => sum + Number(a.totalAmountUsd), 0);
  const totalDebitUzs = acts.reduce((sum, a) => sum + Number(a.totalAmountUzs), 0);
  const totalCreditUsd = payments.reduce((sum, p) => sum + Number(p.amountUsd), 0);
  const totalCreditUzs = payments.reduce((sum, p) => sum + Number(p.amountUzs), 0);

  // The balance the client opened with is part of what they owe.
  const openingUsd = Number(existingSettlement?.openingBalanceUsd) || 0;
  const openingUzs = Number(existingSettlement?.openingBalanceUzs) || 0;
  const closingBalanceUsd = openingUsd + totalDebitUsd - totalCreditUsd;
  const closingBalanceUzs = openingUzs + totalDebitUzs - totalCreditUzs;

  // Debt or advance is judged in the currency the client is settled in.
  const currency = (client?.currency || existingSettlement?.currency || "UZS").toUpperCase();
  const balance = currency === "UZS" ? closingBalanceUzs : closingBalanceUsd;
  const tolerance = currency === "UZS" ? 1 : 0.01;
  let status: "debt" | "settled" | "advance" = "settled";
  if (balance > tolerance) status = "debt";
  else if (balance < -tolerance) status = "advance";

  const lastDate =
    [...payments.map((p) => p.date), ...acts.map((a) => a.date)].filter(Boolean).sort().pop() ||
    new Date().toISOString().split("T")[0];

  if (existingSettlement) {
    await exec
      .update(clientSettlements)
      .set({
        customer: customerName || existingSettlement.customer,
        customerTin: customerTin || existingSettlement.customerTin,
        currency,
        totalDebitUsd: totalDebitUsd.toFixed(2),
        totalDebitUzs: totalDebitUzs.toFixed(2),
        totalCreditUsd: totalCreditUsd.toFixed(2),
        totalCreditUzs: totalCreditUzs.toFixed(2),
        closingBalanceUsd: closingBalanceUsd.toFixed(2),
        closingBalanceUzs: closingBalanceUzs.toFixed(2),
        lastActivityDate: lastDate,
        status,
        updatedAt: new Date(),
      })
      .where(eq(clientSettlements.id, existingSettlement.id));
  } else {
    await exec.insert(clientSettlements).values({
      companyId,
      clientId,
      customer: customerName || client?.name || "",
      customerTin: customerTin || null,
      contractNo: contractNo || null,
      currency,
      totalDebitUsd: totalDebitUsd.toFixed(2),
      totalDebitUzs: totalDebitUzs.toFixed(2),
      totalCreditUsd: totalCreditUsd.toFixed(2),
      totalCreditUzs: totalCreditUzs.toFixed(2),
      closingBalanceUsd: closingBalanceUsd.toFixed(2),
      closingBalanceUzs: closingBalanceUzs.toFixed(2),
      lastActivityDate: lastDate,
      status,
    });
  }
}

// ─── 2b. Credit Control ───────────────────────────────────────────────────────

/** Days an invoice may stay unpaid before the client's new orders are held (business rules §1). */
export const CREDIT_OVERDUE_DAYS = 14;

export interface ClientCreditState {
  clientId: string;
  clientName: string;
  /** What the client owes now, in USD (opening balance + acts − payments). */
  balanceUsd: number;
  /** 0 means no limit is set for the client. */
  creditLimitUsd: number;
  /** Part of the debt that is older than CREDIT_OVERDUE_DAYS. */
  overdueUsd: number;
  oldestOverdueDate: string | null;
  blocked: boolean;
  reason: string | null;
}

/**
 * Whether a client may get a new order released to production.
 * Blocked when the debt is above the client's credit limit or any invoice is unpaid for more
 * than CREDIT_OVERDUE_DAYS. Payments settle the oldest debt first.
 */
export async function getClientCreditState(
  exec: DbExec,
  companyId: string,
  clientId: string,
  today: Date = new Date()
): Promise<ClientCreditState | null> {
  const client = await exec.query.clients.findFirst({
    where: and(eq(clients.companyId, companyId), eq(clients.id, clientId)),
  });
  if (!client) return null;

  const [acts, payments, settlement] = await Promise.all([
    exec.query.deliveryActs.findMany({
      where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.clientId, clientId)),
    }),
    exec.query.clientPayments.findMany({
      where: and(eq(clientPayments.companyId, companyId), eq(clientPayments.clientId, clientId)),
    }),
    exec.query.clientSettlements.findFirst({
      where: and(eq(clientSettlements.companyId, companyId), eq(clientSettlements.clientId, clientId)),
    }),
  ]);
  const liveActs = acts
    .filter((a) => a.status !== "cancelled")
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const paid = payments.filter((p) => p.status !== "cancelled").reduce((sum, p) => sum + Number(p.amountUsd), 0);
  const opening = Number(settlement?.openingBalanceUsd) || 0;
  const debit = liveActs.reduce((sum, a) => sum + Number(a.totalAmountUsd), 0);
  const balanceUsd = Number((opening + debit - paid).toFixed(2));

  // Oldest first: an opening advance adds to the credit, an opening debt is settled before the acts.
  let credit = paid + Math.max(0, -opening);
  credit -= Math.min(credit, Math.max(0, opening));
  const cutoff = new Date(today.getTime() - CREDIT_OVERDUE_DAYS * 86_400_000).toISOString().split("T")[0];
  let overdueUsd = 0;
  let oldestOverdueDate: string | null = null;
  for (const act of liveActs) {
    const amount = Number(act.totalAmountUsd) || 0;
    const settled = Math.min(credit, amount);
    credit -= settled;
    const open = amount - settled;
    if (open > 0.01 && act.date && act.date < cutoff) {
      overdueUsd += open;
      oldestOverdueDate = oldestOverdueDate ?? act.date;
    }
  }
  overdueUsd = Number(overdueUsd.toFixed(2));

  const creditLimitUsd = Number(client.creditLimitUsd) || 0;
  let reason: string | null = null;
  if (overdueUsd > 0.01) {
    reason = `${client.name}: ${oldestOverdueDate} sanasidan beri to'lanmagan qarz bor ($${overdueUsd.toLocaleString("en-US")}, ${CREDIT_OVERDUE_DAYS} kundan oshgan).`;
  } else if (creditLimitUsd > 0 && balanceUsd > creditLimitUsd + 0.01) {
    reason = `${client.name}: qarz $${balanceUsd.toLocaleString("en-US")} kredit limitidan ($${creditLimitUsd.toLocaleString("en-US")}) oshgan.`;
  }

  return {
    clientId: client.id,
    clientName: client.name,
    balanceUsd,
    creditLimitUsd,
    overdueUsd,
    oldestOverdueDate,
    blocked: reason !== null,
    reason,
  };
}

// ─── 3. Settlements List ───────────────────────────────────────────────────────

export async function getClientSettlements(companyCode: string = "PRINTGOO"): Promise<ClientSettlementRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const [raw, allActs, allPayments] = await Promise.all([
    db.query.clientSettlements.findMany({
      where: eq(clientSettlements.companyId, companyId),
      with: {
        client: true,
      },
      orderBy: [desc(clientSettlements.updatedAt)],
    }),
    db.query.deliveryActs.findMany({
      where: eq(deliveryActs.companyId, companyId),
      with: {
        items: {
          orderBy: (items, { asc }) => [asc(items.sortOrder)],
        },
      },
      orderBy: [desc(deliveryActs.date), desc(deliveryActs.createdAt)],
    }),
    db.query.clientPayments.findMany({
      where: eq(clientPayments.companyId, companyId),
      orderBy: [desc(clientPayments.date), desc(clientPayments.createdAt)],
    }),
  ]);

  const statusMap: Record<string, "Debt" | "Settled" | "Advance"> = {
    debt: "Debt",
    settled: "Settled",
    advance: "Advance",
  };

  return raw.map((s) => {
    const custName = (s.customer || s.client?.name || "").trim();
    const custTin = (s.customerTin || s.client?.tin || "").trim();
    const currency = (s.client?.currency || s.currency || "UZS").toUpperCase();
    const isUzs = currency === "UZS";

    const matchesClient = (targetClientId?: string | null, targetName?: string | null, targetTin?: string | null) => {
      if (s.clientId && targetClientId && s.clientId === targetClientId) return true;
      if (custTin.length >= 4 && targetTin && custTin === targetTin.trim()) return true;
      if (custName && targetName && custName.toLowerCase() === targetName.trim().toLowerCase()) return true;
      return false;
    };

    const clientActs = allActs.filter(
      (a) => a.status !== "cancelled" && matchesClient(a.clientId, a.clientName, a.clientTin)
    );
    const clientPays = allPayments.filter(
      (p) => p.status !== "cancelled" && matchesClient(p.clientId, p.customer, null)
    );

    const snapRounding = (val: number) => {
      const nearestThousand = Math.round(val / 1000) * 1000;
      return nearestThousand > 0 && Math.abs(val - nearestThousand) < 1.5 ? nearestThousand : val;
    };

    const combinedEntries = [
      ...clientActs.map((a) => {
        const rate = Number(a.exchangeRate) || 12850;
        const rawUsd = Number(a.totalAmountUsd) || 0;
        const rawUzs = Number(a.totalAmountUzs) || 0;
        const isMistakenlyMultipliedUzs =
          isUzs &&
          (a.currency || "USD").toUpperCase() === "USD" &&
          rawUsd >= 100_000 &&
          Math.abs(rawUzs - Math.round(rawUsd * rate)) <= 5;

        const cleanDebit = isMistakenlyMultipliedUzs
          ? snapRounding(rawUsd)
          : isUzs
          ? snapRounding(rawUzs || rawUsd || 0)
          : rawUsd || rawUzs || 0;

        return {
          id: a.id,
          date: a.date,
          docNo: a.docNo,
          docType: "Schet-faktura" as const,
          description:
            a.items.length > 0
              ? a.items.map((it) => `${it.name} (${Number(it.quantity).toLocaleString()} ${it.unit})`).join(", ")
              : a.notes || "Mahsulot yuklandi (Schet-faktura)",
          debit: cleanDebit,
          credit: 0,
          _ts: a.createdAt ? new Date(a.createdAt).getTime() : 0,
        };
      }),
      ...clientPays.map((p) => ({
        id: p.id,
        date: p.date,
        docNo: p.docNo,
        docType: "Payment" as const,
        description: p.note || `Shartnoma ${p.contractNo || s.contractNo || ""} bo'yicha to'lov`.trim(),
        debit: 0,
        credit: isUzs
          ? Number(p.amountUzs) || Number(p.amountUsd) || 0
          : Number(p.amountUsd) || Number(p.amountUzs) || 0,
        _ts: p.createdAt ? new Date(p.createdAt).getTime() : 0,
      })),
    ].sort((a, b) => {
      const dateCmp = (a.date || "").localeCompare(b.date || "");
      if (dateCmp !== 0) return dateCmp;
      return a._ts - b._ts;
    });

    const ledger = combinedEntries.map(({ _ts, ...entry }) => entry);

    const openingBalance = isUzs
      ? Number(s.openingBalanceUzs) || Number(s.openingBalanceUsd) || 0
      : Number(s.openingBalanceUsd) || 0;

    const totalDebit =
      ledger.length > 0
        ? ledger.reduce((sum, e) => sum + e.debit, 0)
        : isUzs
        ? Number(s.totalDebitUzs) || Number(s.totalDebitUsd) || 0
        : Number(s.totalDebitUsd) || 0;

    const totalCredit =
      ledger.length > 0
        ? ledger.reduce((sum, e) => sum + e.credit, 0)
        : isUzs
        ? Number(s.totalCreditUzs) || Number(s.totalCreditUsd) || 0
        : Number(s.totalCreditUsd) || 0;

    const closingBalance = Number((openingBalance + totalDebit - totalCredit).toFixed(2));
    const computedStatus: "Debt" | "Settled" | "Advance" =
      closingBalance > 0.01 ? "Debt" : closingBalance < -0.01 ? "Advance" : "Settled";

    return {
      id: s.id,
      customer: custName,
      customerTin: custTin,
      contractNo: s.contractNo || s.client?.contractNo || "K-2026/01",
      openingBalance,
      totalDebit,
      totalCredit,
      closingBalance,
      currency,
      lastActivityDate: s.lastActivityDate || new Date().toISOString().split("T")[0],
      status: computedStatus,
      ledger,
    };
  });
}

// ─── 4. Payments ──────────────────────────────────────────────────────────────

export async function getClientPayments(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const raw = await db.query.clientPayments.findMany({
    where: eq(clientPayments.companyId, companyId),
    with: {
      client: true,
      bankAccount: true,
    },
    orderBy: [desc(clientPayments.date), desc(clientPayments.createdAt)],
  });

  const methodMap: Record<string, string> = {
    bank_transfer: "Bank Wire (Hisob-raqam)",
    cash: "Cash / Kassa",
    corporate_card: "Corporate Card",
    offset: "Vzaimozachet (Offset)",
  };

  return raw.map((p) => ({
    id: p.docNo || p.id,
    date: p.date,
    customer: p.customer || p.client?.name || "",
    customerTin: p.client?.tin || "",
    contractNo: p.contractNo || "K-2026/01",
    amount: Number(p.amountUsd) || 0,
    amountUzs: Number(p.amountUzs) || 0,
    currency: p.currency || "USD",
    method: methodMap[p.method] || "Bank Wire (Hisob-raqam)",
    bankAccount: p.bankAccount?.name || undefined,
    note: p.note || "",
    status: p.status,
  }));
}

export async function recordPayment(
  data: {
    customer: string;
    clientId?: string | null;
    amount: number;
    docNo?: string;
    date?: string;
    currency?: string;
    exchangeRate?: number;
    method?: "bank_transfer" | "cash" | "corporate_card" | "offset";
    note?: string;
    contractNo?: string;
    /** The act this payment settles: its UUID or number (SF-…). */
    deliveryActId?: string | null;
  },
  companyCode: string = "PRINTGOO",
  exec: DbExec = db
) {
  const companyId = await getCompanyIdByCode(companyCode);
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("To'lov summasi 0 dan katta bo'lishi kerak.");
  }
  const customerName = String(data.customer || "").trim();

  return exec.transaction(async (tx) => {
    // A payment is booked on a client that exists: a typo must not open a second balance.
    const targetClient = await resolveClient(tx, companyId, { id: data.clientId, name: customerName });
    if (!targetClient) throw new Error(unknownClientMessage(customerName));

    let actId: string | null = null;
    const actKey = String(data.deliveryActId || "").trim();
    if (actKey) {
      const act = await tx.query.deliveryActs.findFirst({
        where: and(
          eq(deliveryActs.companyId, companyId),
          UUID_RE.test(actKey) ? eq(deliveryActs.id, actKey) : eq(deliveryActs.docNo, actKey)
        ),
      });
      if (!act) throw new Error(`${actKey} schet-fakturasi topilmadi.`);
      if (act.clientId !== targetClient.id) {
        throw new Error(`${act.docNo} schet-fakturasi boshqa mijozga tegishli.`);
      }
      if (act.status === "cancelled") throw new Error(`${act.docNo} schet-fakturasi bekor qilingan.`);
      actId = act.id;
    }

    const company = await tx.query.companies.findFirst({ where: eq(companies.id, companyId) });
    const rate = Number(data.exchangeRate) || companyExchangeRate(company);
    // Paid in the client's own currency unless the document says otherwise.
    const currency = (data.currency || targetClient.currency || "UZS").toUpperCase();
    const isUsd = currency === "USD";
    const amountUsd = isUsd ? amount : Math.round((amount / rate) * 100) / 100;
    const amountUzs = isUsd ? Math.round(amount * rate) : amount;

    let docNo = String(data.docNo || "").trim();
    if (docNo) {
      const taken = await tx.query.clientPayments.findFirst({
        where: and(eq(clientPayments.companyId, companyId), eq(clientPayments.docNo, docNo)),
      });
      if (taken) throw new Error(`${docNo} raqamli to'lov hujjati allaqachon mavjud.`);
    } else {
      await lockNumbering(tx, companyId, "PAY");
      const yearSuffix = getCurrentYearSuffix();
      const rows = await tx
        .select({ num: clientPayments.docNo })
        .from(clientPayments)
        .where(and(eq(clientPayments.companyId, companyId), ilike(clientPayments.docNo, `PAY-${yearSuffix}-%`)));
      docNo = calculateNextNumber("PAY", rows.map((r) => r.num), yearSuffix);
    }
    const date = data.date || new Date().toISOString().split("T")[0];

    const [payment] = await tx
      .insert(clientPayments)
      .values({
        companyId,
        docNo,
        date,
        clientId: targetClient.id,
        customer: targetClient.name,
        contractNo: data.contractNo || targetClient.contractNo || null,
        amountUsd: amountUsd.toString(),
        amountUzs: amountUzs.toString(),
        exchangeRate: rate.toString(),
        currency,
        method: data.method || "bank_transfer",
        deliveryActId: actId,
        note: data.note || null,
        status: "confirmed",
      })
      .returning();

    await syncClientSettlement(companyId, targetClient.id, targetClient.name, targetClient.tin || undefined, undefined, tx);

    return { success: true, payment };
  });
}

// ─── 5. Bank Accounts ─────────────────────────────────────────────────────────

export async function getBankAccounts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.bankAccounts.findMany({
    where: eq(bankAccounts.companyId, companyId),
    orderBy: [desc(bankAccounts.isDefault), desc(bankAccounts.createdAt)],
  });
}
