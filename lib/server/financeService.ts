import { db } from "@/db";
import {
  deliveryActs,
  deliveryActItems,
  clientSettlements,
  clientPayments,
  bankAccounts,
  companies,
  clients,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import { getNextDeliveryActNumber } from "./numberingService";
import { emitNotification } from "./notificationService";
import type { DeliveryActRecord, ClientSettlementRecord } from "@/store/workspaceStore";

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
    };

    return {
      id: act.docNo || act.id,
      date: act.date,
      orderId: act.docNo,
      workOrderId: act.workOrderId || "",
      contractNo: act.contractNo || "",
      customer: act.clientName || act.client?.name || "",
      customerTin: act.clientTin || act.client?.tin || "",
      product: firstItem ? firstItem.name : "Bosma mahsulotlar",
      quantity: firstItem ? Number(firstItem.quantity) : 0,
      unit: firstItem ? firstItem.unit : "dona",
      subtotal: Number(act.subtotalUsd) || Number(act.subtotalUzs) || 0,
      vatRate: Number(act.vatRate) || 12,
      vatAmount: Number(act.vatAmountUsd) || Number(act.vatAmountUzs) || 0,
      totalAmount: Number(act.totalAmountUsd) || Number(act.totalAmountUzs) || 0,
      currency: act.currency || "USD",
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
        unitPrice: Number(it.unitPriceUsd) || Number(it.unitPriceUzs) || 0,
        vatRate: Number(it.vatRate) || 12,
      })),
    };
  });
}

export async function upsertDeliveryAct(
  data: Partial<DeliveryActRecord> & { clientTin?: string; exchangeRate?: number },
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  // 1. Mijozni INN yoki nomi bo'yicha topish yoki yaratish
  let targetClientId: string | null = null;
  const tinToSearch = data.customerTin?.trim();
  if (tinToSearch) {
    const existingClient = await db.query.clients.findFirst({
      where: and(eq(clients.companyId, companyId), eq(clients.tin, tinToSearch)),
    });
    if (existingClient) {
      targetClientId = existingClient.id;
    }
  }

  if (!targetClientId && data.customer) {
    const existingByName = await db.query.clients.findFirst({
      where: and(eq(clients.companyId, companyId), eq(clients.name, data.customer.trim())),
    });
    if (existingByName) {
      targetClientId = existingByName.id;
    }
  }

  // Agar mijoz topilmasa, bazada yangi mijoz yaratamiz
  if (!targetClientId) {
    const newClientCode = `CUST-${Date.now().toString().slice(-4)}`;
    const [insertedClient] = await db
      .insert(clients)
      .values({
        companyId,
        code: newClientCode,
        name: data.customer?.trim() || "Noma'lum Mijoz",
        tin: tinToSearch || null,
        contractNo: data.contractNo || null,
      })
      .returning();
    targetClientId = insertedClient.id;
  }

  const docNo = data.id?.startsWith("ACT-") ? data.id : await getNextDeliveryActNumber(companyCode);
  const date = data.date || new Date().toISOString().split("T")[0];

  const dbStatusMap: Record<string, "draft" | "pending_signature" | "signed" | "disputed"> = {
    Draft: "draft",
    "Pending Signature": "pending_signature",
    "Signed & Stamped": "signed",
    Disputed: "disputed",
  };

  const status = data.status ? dbStatusMap[data.status] || "draft" : "draft";
  const rate = data.exchangeRate || 12850;
  const total = Number(data.totalAmount) || 0;
  const subtotal = Number(data.subtotal) || 0;
  const vatAmount = Number(data.vatAmount) || 0;
  const isUsd = (data.currency || "USD").toUpperCase() === "USD";

  const totalUsd = isUsd ? total : Math.round((total / rate) * 100) / 100;
  const totalUzs = isUsd ? Math.round(total * rate) : total;
  const subtotalUsd = isUsd ? subtotal : Math.round((subtotal / rate) * 100) / 100;
  const subtotalUzs = isUsd ? Math.round(subtotal * rate) : subtotal;
  const vatUsd = isUsd ? vatAmount : Math.round((vatAmount / rate) * 100) / 100;
  const vatUzs = isUsd ? Math.round(vatAmount * rate) : vatAmount;

  // Mavjud akt bormi?
  const existingAct = await db.query.deliveryActs.findFirst({
    where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.docNo, docNo)),
  });

  let actId: string;

  if (existingAct) {
    actId = existingAct.id;
    await db
      .update(deliveryActs)
      .set({
        date,
        clientId: targetClientId,
        clientName: data.customer || existingAct.clientName,
        clientTin: data.customerTin || existingAct.clientTin,
        contractNo: data.contractNo || existingAct.contractNo,
        carrier: data.carrier || existingAct.carrier,
        driverName: data.driverName || existingAct.driverName,
        recipientName: data.recipientName || existingAct.recipientName,
        subtotalUsd: subtotalUsd.toString(),
        subtotalUzs: subtotalUzs.toString(),
        exchangeRate: rate.toString(),
        vatRate: (data.vatRate || 12).toString(),
        vatAmountUsd: vatUsd.toString(),
        vatAmountUzs: vatUzs.toString(),
        totalAmountUsd: totalUsd.toString(),
        totalAmountUzs: totalUzs.toString(),
        currency: data.currency || "USD",
        warehouse: data.warehouse || existingAct.warehouse,
        status,
        notes: data.notes || existingAct.notes,
        updatedAt: new Date(),
      })
      .where(eq(deliveryActs.id, actId));

    // Eski itemlarni tozalab yangilarini qo'shamiz
    await db.delete(deliveryActItems).where(eq(deliveryActItems.actId, actId));
  } else {
    const [created] = await db
      .insert(deliveryActs)
      .values({
        companyId,
        docNo,
        date,
        clientId: targetClientId,
        clientName: data.customer || "Noma'lum Mijoz",
        clientTin: data.customerTin || null,
        contractNo: data.contractNo || null,
        carrier: data.carrier || null,
        driverName: data.driverName || null,
        recipientName: data.recipientName || null,
        subtotalUsd: subtotalUsd.toString(),
        subtotalUzs: subtotalUzs.toString(),
        exchangeRate: rate.toString(),
        vatRate: (data.vatRate || 12).toString(),
        vatAmountUsd: vatUsd.toString(),
        vatAmountUzs: vatUzs.toString(),
        totalAmountUsd: totalUsd.toString(),
        totalAmountUzs: totalUzs.toString(),
        currency: data.currency || "USD",
        warehouse: data.warehouse || "Asosiy Ombor (Tayyor Mahsulot)",
        status,
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
        vatRate: (it.vatRate || 12).toString(),
        sortOrder: idx,
      };
    });
    await db.insert(deliveryActItems).values(itemRows);
  }

  // 2. Client Settlements (Mijoz balansi)ni avtomatik yangilash
  await syncClientSettlement(companyId, targetClientId, data.customer || "", data.customerTin, data.contractNo);

  // 3. Bildirishnoma triggeri (Schet-faktura rasmiylashtirildi)
  try {
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
  } catch (_) {}

  return { success: true, docNo, id: actId };
}

// ─── 2. Settlements Synchronization ────────────────────────────────────────────

export async function syncClientSettlement(
  companyId: string,
  clientId: string,
  customerName: string,
  customerTin?: string,
  contractNo?: string
) {
  // Mijozning barcha aktlari summasini (Debit) va to'lovlarini (Credit) hisoblash
  const acts = await db.query.deliveryActs.findMany({
    where: and(eq(deliveryActs.companyId, companyId), eq(deliveryActs.clientId, clientId)),
  });

  const payments = await db.query.clientPayments.findMany({
    where: and(eq(clientPayments.companyId, companyId), eq(clientPayments.clientId, clientId)),
  });

  const totalDebitUsd = acts.reduce((sum, a) => sum + Number(a.totalAmountUsd), 0);
  const totalDebitUzs = acts.reduce((sum, a) => sum + Number(a.totalAmountUzs), 0);
  const totalCreditUsd = payments.reduce((sum, p) => sum + Number(p.amountUsd), 0);
  const totalCreditUzs = payments.reduce((sum, p) => sum + Number(p.amountUzs), 0);

  const closingBalanceUsd = totalDebitUsd - totalCreditUsd;
  const closingBalanceUzs = totalDebitUzs - totalCreditUzs;

  let status: "debt" | "settled" | "advance" = "settled";
  if (closingBalanceUsd > 1) status = "debt";
  else if (closingBalanceUsd < -1) status = "advance";

  const existingSettlement = await db.query.clientSettlements.findFirst({
    where: and(eq(clientSettlements.companyId, companyId), eq(clientSettlements.clientId, clientId)),
  });

  const lastDate =
    payments[0]?.date || acts[0]?.date || new Date().toISOString().split("T")[0];

  if (existingSettlement) {
    await db
      .update(clientSettlements)
      .set({
        customer: customerName || existingSettlement.customer,
        customerTin: customerTin || existingSettlement.customerTin,
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
    await db.insert(clientSettlements).values({
      companyId,
      clientId,
      customer: customerName,
      customerTin: customerTin || null,
      contractNo: contractNo || null,
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

// ─── 3. Settlements List ───────────────────────────────────────────────────────

export async function getClientSettlements(companyCode: string = "PRINTGOO"): Promise<ClientSettlementRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const raw = await db.query.clientSettlements.findMany({
    where: eq(clientSettlements.companyId, companyId),
    with: {
      client: true,
    },
    orderBy: [desc(clientSettlements.updatedAt)],
  });

  const statusMap: Record<string, "Debt" | "Settled" | "Advance"> = {
    debt: "Debt",
    settled: "Settled",
    advance: "Advance",
  };

  return raw.map((s) => ({
    id: s.id,
    customer: s.customer || s.client?.name || "",
    customerTin: s.customerTin || s.client?.tin || "",
    contractNo: s.contractNo || s.client?.contractNo || "K-2026/01",
    openingBalance: Number(s.openingBalanceUsd) || 0,
    totalDebit: Number(s.totalDebitUsd) || 0,
    totalCredit: Number(s.totalCreditUsd) || 0,
    closingBalance: Number(s.closingBalanceUsd) || 0,
    currency: s.currency || "USD",
    lastActivityDate: s.lastActivityDate || new Date().toISOString().split("T")[0],
    status: statusMap[s.status] || "Settled",
    ledger: [],
  }));
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
    amount: number;
    docNo?: string;
    date?: string;
    currency?: string;
    exchangeRate?: number;
    method?: "bank_transfer" | "cash" | "corporate_card" | "offset";
    note?: string;
    contractNo?: string;
  },
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  // Mijozni topish
  let targetClient = await db.query.clients.findFirst({
    where: and(eq(clients.companyId, companyId), eq(clients.name, data.customer.trim())),
  });

  if (!targetClient) {
    const newClientCode = `CUST-${Date.now().toString().slice(-4)}`;
    const [created] = await db
      .insert(clients)
      .values({
        companyId,
        code: newClientCode,
        name: data.customer.trim(),
      })
      .returning();
    targetClient = created;
  }

  const rate = data.exchangeRate || 12850;
  const isUsd = (data.currency || "USD").toUpperCase() === "USD";
  const amountUsd = isUsd ? data.amount : Math.round((data.amount / rate) * 100) / 100;
  const amountUzs = isUsd ? Math.round(data.amount * rate) : data.amount;

  const docNo = data.docNo || `PAY-${Date.now().toString().slice(-6)}`;
  const date = data.date || new Date().toISOString().split("T")[0];

  const [payment] = await db
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
      currency: data.currency || "USD",
      method: data.method || "bank_transfer",
      note: data.note || null,
      status: "confirmed",
    })
    .returning();

  // Settlements ni yangilaymiz
  await syncClientSettlement(companyId, targetClient.id, targetClient.name, targetClient.tin || undefined);

  return { success: true, payment };
}

// ─── 5. Bank Accounts ─────────────────────────────────────────────────────────

export async function getBankAccounts(companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);
  return db.query.bankAccounts.findMany({
    where: eq(bankAccounts.companyId, companyId),
    orderBy: [desc(bankAccounts.isDefault), desc(bankAccounts.createdAt)],
  });
}
