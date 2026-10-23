import { db } from "@/db";
import {
  suppliers,
  supplierOrders,
  supplierPayments,
  bankAccounts,
  warehouseReceipts,
} from "@/db/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";

export type SupplierCategory =
  | "raw_materials"
  | "cmyk_inks"
  | "ctp_prepress"
  | "die_tooling"
  | "cliche_stamping"
  | "outsourcing"
  | "logistics"
  | "spare_parts"
  | "other";

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  category: SupplierCategory;
  tin?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  bankName?: string;
  bankAccount?: string;
  mfo?: string;
  currentBalance: number;
  currency: string;
  paymentTerms?: string;
  address?: string;
  notes?: string;
  status: "Active" | "Blocked" | "Archived";
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierOrderRecord {
  id: string;
  supplierId: string;
  orderNo: string;
  orderDate: string;
  deliveryDeadline?: string;
  orderType: "die_tooling" | "ctp_plates" | "cliche" | "raw_materials" | "outsourcing" | "service";
  title: string;
  workOrderId?: string;
  workOrderNo?: string;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
  status: "Draft" | "Ordered" | "In_Production" | "Ready" | "Delivered" | "Cancelled";
  specDetails?: string;
  notes?: string;
  createdAt?: string;
}

export interface SupplierPaymentRecord {
  id: string;
  docNo: string;
  date: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  method: "bank_transfer" | "cash" | "corporate_card" | "offset";
  bankAccountId?: string;
  bankAccountName?: string;
  supplierOrderId?: string;
  note?: string;
  status: string;
  createdAt?: string;
}

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  docNo: string;
  docType: "Kirim / Xizmat" | "To'lov" | "Buyurtma";
  description: string;
  debit: number;  // Biz to'lagan summa (-Bizning qarzimiz kamayadi)
  credit: number; // Yetkazilgan xomashyo/xizmat (+Bizning qarzimiz ko'payadi)
  balance: number;// Qoldiq qarzimiz
}

// ─── 1. Suppliers List & Upsert ───────────────────────────────────────────────

export async function getSuppliers(companyCode: string = "PRINTGOO"): Promise<SupplierRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const raw = await db.query.suppliers.findMany({
    where: eq(suppliers.companyId, companyId),
    orderBy: [desc(suppliers.createdAt)],
  });

  return raw.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    legalName: s.legalName || undefined,
    category: s.category as SupplierCategory,
    tin: s.tin || "",
    contactPerson: s.contactPerson || "",
    phone: s.phone || "",
    email: s.email || "",
    bankName: s.bankName || undefined,
    bankAccount: s.bankAccount || undefined,
    mfo: s.mfo || undefined,
    currentBalance: Number(s.currentBalance) || 0,
    currency: s.currency || "UZS",
    paymentTerms: s.paymentTerms || "",
    address: s.address || "",
    notes: s.notes || "",
    status: s.status as SupplierRecord["status"],
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function getSupplierById(idOrCode: string, companyCode: string = "PRINTGOO"): Promise<SupplierRecord | null> {
  const companyId = await getCompanyIdByCode(companyCode);

  const s = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      or(eq(suppliers.id, idOrCode), eq(suppliers.code, idOrCode))
    ),
  });

  if (!s) return null;

  return {
    id: s.id,
    code: s.code,
    name: s.name,
    legalName: s.legalName || undefined,
    category: s.category as SupplierCategory,
    tin: s.tin || "",
    contactPerson: s.contactPerson || "",
    phone: s.phone || "",
    email: s.email || "",
    bankName: s.bankName || undefined,
    bankAccount: s.bankAccount || undefined,
    mfo: s.mfo || undefined,
    currentBalance: Number(s.currentBalance) || 0,
    currency: s.currency || "UZS",
    paymentTerms: s.paymentTerms || "",
    address: s.address || "",
    notes: s.notes || "",
    status: s.status as SupplierRecord["status"],
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function upsertSupplier(
  data: Partial<SupplierRecord>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let code = data.code?.trim();
  if (!code) {
    const count = await db.$count(suppliers, eq(suppliers.companyId, companyId));
    code = `SUP-${100 + count + 1}`;
  }

  let existing = null;
  if (data.id && !data.id.startsWith("draft-") && !data.id.startsWith("new-")) {
    existing = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.companyId, companyId), eq(suppliers.id, data.id)),
    });
  }

  if (!existing && code) {
    existing = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.companyId, companyId), eq(suppliers.code, code)),
    });
  }

  if (existing) {
    const [updated] = await db
      .update(suppliers)
      .set({
        name: data.name || existing.name,
        legalName: data.legalName !== undefined ? data.legalName : existing.legalName,
        category: (data.category as any) || existing.category,
        tin: data.tin !== undefined ? data.tin : existing.tin,
        contactPerson: data.contactPerson !== undefined ? data.contactPerson : existing.contactPerson,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        email: data.email !== undefined ? data.email : existing.email,
        bankName: data.bankName !== undefined ? data.bankName : existing.bankName,
        bankAccount: data.bankAccount !== undefined ? data.bankAccount : existing.bankAccount,
        mfo: data.mfo !== undefined ? data.mfo : existing.mfo,
        currentBalance: data.currentBalance !== undefined ? data.currentBalance.toString() : existing.currentBalance,
        currency: data.currency || existing.currency,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : existing.paymentTerms,
        address: data.address !== undefined ? data.address : existing.address,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        status: (data.status as any) || existing.status,
        updatedAt: new Date(),
      })
      .where(eq(suppliers.id, existing.id))
      .returning();

    return { success: true, supplier: updated };
  } else {
    const [created] = await db
      .insert(suppliers)
      .values({
        companyId,
        code,
        name: data.name || "Noma'lum Ta'minotchi",
        legalName: data.legalName || null,
        category: (data.category as any) || "raw_materials",
        tin: data.tin || null,
        contactPerson: data.contactPerson || null,
        phone: data.phone || null,
        email: data.email || null,
        bankName: data.bankName || null,
        bankAccount: data.bankAccount || null,
        mfo: data.mfo || null,
        currentBalance: (data.currentBalance || 0).toString(),
        currency: data.currency || "UZS",
        paymentTerms: data.paymentTerms || null,
        address: data.address || null,
        notes: data.notes || null,
        status: (data.status as any) || "Active",
      })
      .returning();

    return { success: true, supplier: created };
  }
}

export async function deleteSupplier(idOrCode: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const existing = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      eq(suppliers.id, idOrCode)
    ),
  });

  if (existing) {
    await db.delete(suppliers).where(eq(suppliers.id, existing.id));
    return { success: true };
  }

  await db.delete(suppliers).where(
    and(eq(suppliers.companyId, companyId), eq(suppliers.code, idOrCode))
  );
  return { success: true };
}

// ─── 2. Supplier Orders (Purchase Orders) ─────────────────────────────────────

export async function getSupplierOrders(supplierIdOrCode: string, companyCode: string = "PRINTGOO"): Promise<SupplierOrderRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  // Ta'minotchi ID sini aniqlash
  const supp = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      or(eq(suppliers.id, supplierIdOrCode), eq(suppliers.code, supplierIdOrCode))
    ),
  });

  if (!supp) return [];

  const raw = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      eq(supplierOrders.supplierId, supp.id)
    ),
    orderBy: [desc(supplierOrders.orderDate), desc(supplierOrders.createdAt)],
  });

  return raw.map((o) => ({
    id: o.id,
    supplierId: o.supplierId,
    orderNo: o.orderNo,
    orderDate: o.orderDate,
    deliveryDeadline: o.deliveryDeadline || undefined,
    orderType: o.orderType as any,
    title: o.title,
    workOrderId: o.workOrderId || undefined,
    workOrderNo: o.workOrderNo || undefined,
    quantity: Number(o.quantity) || 1,
    unit: o.unit || "dona",
    amount: Number(o.amount) || 0,
    currency: o.currency || "UZS",
    status: o.status as any,
    specDetails: o.specDetails || undefined,
    notes: o.notes || undefined,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function upsertSupplierOrder(
  data: Partial<SupplierOrderRecord>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let orderNo = data.orderNo?.trim();
  if (!orderNo) {
    const count = await db.$count(supplierOrders, eq(supplierOrders.companyId, companyId));
    orderNo = `PO-${Date.now().toString().slice(-4)}-${count + 1}`;
  }

  const existing = data.id
    ? await db.query.supplierOrders.findFirst({
        where: and(eq(supplierOrders.companyId, companyId), eq(supplierOrders.id, data.id)),
      })
    : null;

  let savedOrder;
  if (existing) {
    const [updated] = await db
      .update(supplierOrders)
      .set({
        orderDate: data.orderDate || existing.orderDate,
        deliveryDeadline: data.deliveryDeadline !== undefined ? data.deliveryDeadline : existing.deliveryDeadline,
        orderType: data.orderType || existing.orderType,
        title: data.title || existing.title,
        workOrderId: data.workOrderId !== undefined ? data.workOrderId : existing.workOrderId,
        workOrderNo: data.workOrderNo !== undefined ? data.workOrderNo : existing.workOrderNo,
        quantity: (data.quantity || 1).toString(),
        unit: data.unit || existing.unit,
        amount: (data.amount || 0).toString(),
        currency: data.currency || existing.currency,
        status: data.status || existing.status,
        specDetails: data.specDetails !== undefined ? data.specDetails : existing.specDetails,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(supplierOrders.id, existing.id))
      .returning();
    savedOrder = updated;
  } else {
    const [created] = await db
      .insert(supplierOrders)
      .values({
        companyId,
        supplierId: data.supplierId!,
        orderNo,
        orderDate: data.orderDate || new Date().toISOString().split("T")[0],
        deliveryDeadline: data.deliveryDeadline || null,
        orderType: data.orderType || "raw_materials",
        title: data.title || "Buyurtma",
        workOrderId: data.workOrderId || null,
        workOrderNo: data.workOrderNo || null,
        quantity: (data.quantity || 1).toString(),
        unit: data.unit || "dona",
        amount: (data.amount || 0).toString(),
        currency: data.currency || "UZS",
        status: data.status || "Ordered",
        specDetails: data.specDetails || null,
        notes: data.notes || null,
      })
      .returning();
    savedOrder = created;
  }

  // Ta'minotchi qarzini yangilash
  await syncSupplierBalance(companyId, savedOrder.supplierId);

  return { success: true, order: savedOrder };
}

// ─── 3. Supplier Payments (Chiqim to'lovlari) ──────────────────────────────────

export async function getSupplierPayments(supplierIdOrCode: string, companyCode: string = "PRINTGOO"): Promise<SupplierPaymentRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const supp = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      or(eq(suppliers.id, supplierIdOrCode), eq(suppliers.code, supplierIdOrCode))
    ),
  });

  if (!supp) return [];

  const raw = await db.query.supplierPayments.findMany({
    where: and(
      eq(supplierPayments.companyId, companyId),
      eq(supplierPayments.supplierId, supp.id)
    ),
    with: {
      bankAccount: true,
    },
    orderBy: [desc(supplierPayments.date), desc(supplierPayments.createdAt)],
  });

  return raw.map((p) => ({
    id: p.id,
    docNo: p.docNo,
    date: p.date,
    supplierId: p.supplierId,
    supplierName: p.supplierName,
    amount: Number(p.amount) || 0,
    currency: p.currency,
    method: p.method as any,
    bankAccountId: p.bankAccountId || undefined,
    bankAccountName: p.bankAccount?.name || undefined,
    supplierOrderId: p.supplierOrderId || undefined,
    note: p.note || undefined,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));
}

export async function recordSupplierPayment(
  data: {
    supplierId: string;
    amount: number;
    currency?: string;
    method?: "bank_transfer" | "cash" | "corporate_card" | "offset";
    bankAccountId?: string;
    supplierOrderId?: string;
    note?: string;
    date?: string;
  },
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  const supp = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      or(eq(suppliers.id, data.supplierId), eq(suppliers.code, data.supplierId))
    ),
  });

  if (!supp) throw new Error("Ta'minotchi topilmadi!");

  const docNo = `SPAY-${Date.now().toString().slice(-6)}`;
  const date = data.date || new Date().toISOString().split("T")[0];

  const [payment] = await db
    .insert(supplierPayments)
    .values({
      companyId,
      docNo,
      date,
      supplierId: supp.id,
      supplierName: supp.name,
      amount: data.amount.toString(),
      currency: data.currency || supp.currency || "UZS",
      method: data.method || "bank_transfer",
      bankAccountId: data.bankAccountId || null,
      supplierOrderId: data.supplierOrderId || null,
      note: data.note || null,
      status: "confirmed",
    })
    .returning();

  // Agar bank hisobi tanlangan bo'lsa, uning balansidan yechamiz
  if (data.bankAccountId) {
    await db
      .update(bankAccounts)
      .set({
        balance: sql`${bankAccounts.balance} - ${data.amount}`,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, data.bankAccountId));
  }

  // Ta'minotchi qarzini yangilash
  await syncSupplierBalance(companyId, supp.id);

  return { success: true, payment };
}

// ─── 4. Akt-sverka Xronologiyasi (Ledger Reconciliation) ──────────────────────

export async function getSupplierSettlementLedger(supplierIdOrCode: string, companyCode: string = "PRINTGOO"): Promise<{
  supplier: SupplierRecord;
  ledger: SupplierLedgerEntry[];
  totalCredit: number; // Jami olingan tovar/xizmat
  totalDebit: number;  // Jami to'langan pul
  closingBalance: number; // Qoldiq qarzimiz
}> {
  const companyId = await getCompanyIdByCode(companyCode);

  const supp = await getSupplierById(supplierIdOrCode, companyCode);
  if (!supp) throw new Error("Ta'minotchi topilmadi!");

  // 1. Buyurtmalar (Yetkazilgan yoki bajarilgan zakazlar: CTP, shtamp, material)
  const orders = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      eq(supplierOrders.supplierId, supp.id),
      or(eq(supplierOrders.status, "Ready"), eq(supplierOrders.status, "Delivered"), eq(supplierOrders.status, "Ordered"))
    ),
    orderBy: [supplierOrders.orderDate],
  });

  // 2. Ombor kirimlari (agar supplierName bo'yicha bog'langan bo'lsa)
  const receipts = await db.query.warehouseReceipts.findMany({
    where: and(
      eq(warehouseReceipts.companyId, companyId),
      or(
        eq(warehouseReceipts.supplierName, supp.name),
        eq(warehouseReceipts.supplierName, supp.legalName || "")
      )
    ),
    orderBy: [warehouseReceipts.receiptDate],
  });

  // 3. To'lovlar
  const payments = await db.query.supplierPayments.findMany({
    where: and(
      eq(supplierPayments.companyId, companyId),
      eq(supplierPayments.supplierId, supp.id)
    ),
    orderBy: [supplierPayments.date],
  });

  // Xronologik birlashtirish
  type RawEntry = {
    date: string;
    docNo: string;
    docType: "Kirim / Xizmat" | "To'lov" | "Buyurtma";
    description: string;
    debit: number;
    credit: number;
    createdAt: Date;
  };

  const rawEntries: RawEntry[] = [];

  // Orders
  for (const o of orders) {
    rawEntries.push({
      date: o.orderDate,
      docNo: o.orderNo,
      docType: "Buyurtma",
      description: `${o.title} (${o.workOrderNo ? `WO: ${o.workOrderNo}` : o.orderType})`,
      debit: 0,
      credit: Number(o.amount) || 0,
      createdAt: o.createdAt,
    });
  }

  // Ombor kirimlari (agar orders da bo'lmagan mustaqil kirim bo'lsa)
  for (const r of receipts) {
    rawEntries.push({
      date: r.receiptDate.toISOString().split("T")[0],
      docNo: r.receiptNumber,
      docType: "Kirim / Xizmat",
      description: `Ombor kirimi (PO: ${r.poNumber || "-"})`,
      debit: 0,
      credit: Number(r.totalAmount) || 0,
      createdAt: r.createdAt,
    });
  }

  // To'lovlar
  for (const p of payments) {
    rawEntries.push({
      date: p.date,
      docNo: p.docNo,
      docType: "To'lov",
      description: `Chiqim to'lovi (${p.method})${p.note ? `: ${p.note}` : ""}`,
      debit: Number(p.amount) || 0,
      credit: 0,
      createdAt: p.createdAt,
    });
  }

  // Sanalar bo'yicha o'sish tartibida saralash
  rawEntries.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  let runningBalance = 0;
  let totalCredit = 0;
  let totalDebit = 0;

  const ledger: SupplierLedgerEntry[] = rawEntries.map((e, idx) => {
    totalCredit += e.credit;
    totalDebit += e.debit;
    // Bizning qarzimiz: +Yetkazilgan (Credit) - To'langan (Debit)
    runningBalance += e.credit - e.debit;

    return {
      id: `led-${idx + 1}`,
      date: e.date,
      docNo: e.docNo,
      docType: e.docType,
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance: runningBalance,
    };
  });

  return {
    supplier: supp,
    ledger,
    totalCredit,
    totalDebit,
    closingBalance: runningBalance,
  };
}

// ─── 5. Sync Supplier Balance ─────────────────────────────────────────────────

export async function syncSupplierBalance(companyId: string, supplierId: string) {
  // Barcha buyurtmalar summasi (Credit)
  const orders = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      eq(supplierOrders.supplierId, supplierId),
      or(eq(supplierOrders.status, "Ready"), eq(supplierOrders.status, "Delivered"), eq(supplierOrders.status, "Ordered"))
    ),
  });

  // Barcha to'lovlar summasi (Debit)
  const payments = await db.query.supplierPayments.findMany({
    where: and(
      eq(supplierPayments.companyId, companyId),
      eq(supplierPayments.supplierId, supplierId)
    ),
  });

  const totalCredit = orders.reduce((sum, o) => sum + Number(o.amount), 0);
  const totalDebit = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const closingBalance = totalCredit - totalDebit;

  await db
    .update(suppliers)
    .set({
      currentBalance: closingBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, supplierId));
}
