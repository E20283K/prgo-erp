import { db } from "@/db";
import {
  suppliers,
  supplierOrders,
  supplierPayments,
  supplierContracts,
  bankAccounts,
  warehouseReceipts,
  workOrders,
} from "@/db/schema";
import { eq, desc, and, or, sql, ilike } from "drizzle-orm";
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
  openingBalance: number;
  currentBalance: number;
  currency: string;
  paymentTerms?: string;
  address?: string;
  notes?: string;
  imageUrl?: string;
  logoUrl?: string;
  status: "Active" | "Blocked" | "Archived";
  createdAt?: string;
  updatedAt?: string;
}

export interface SupplierContractRecord {
  id: string;
  companyId?: string;
  supplierId: string;
  contractNo: string;
  title: string;
  type: "annual" | "one_time" | "framework";
  startDate: string;
  endDate?: string;
  status: "active" | "expired" | "suspended";
  paymentTerms?: string;
  currency: string;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentSize?: string;
  notes?: string;
  imageUrl?: string;
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
  fileUrl?: string;
  fileName?: string;
  imageUrl?: string;
  telegramChatId?: string | null;
  telegramMessageId?: number | null;
  telegramSentAt?: string | null;
  telegramConfirmedBy?: string | null;
  createdAt?: string;
}

export interface ToolingOrderRecord extends SupplierOrderRecord {
  supplierName?: string;
  supplierCode?: string;
  supplierPhone?: string;
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

  let raw = await db.query.suppliers.findMany({
    where: eq(suppliers.companyId, companyId),
    orderBy: [desc(suppliers.createdAt)],
  });

  if (raw.length === 0) {
    const defaultSuppliers = [
      {
        companyId,
        code: "SUP-101",
        name: "Toshkent CTP Markazi",
        legalName: "Toshkent CTP Prepress MCHJ",
        category: "ctp_prepress" as const,
        tin: "305123456",
        contactPerson: "Farhod Usmonov",
        phone: "+998 90 123-45-67",
        email: "ctp@prepress.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "CTP metall formalar, termal plastinalar, rang ajratish",
      },
      {
        companyId,
        code: "SUP-102",
        name: "Laser Die Shtamp Servis",
        legalName: "Laser Die Technology MCHJ",
        category: "die_tooling" as const,
        tin: "306234567",
        contactPerson: "Akmal Qodirov",
        phone: "+998 93 456-78-90",
        email: "info@laserdie.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Lazer kesim shtansformalar, perfo pichoqlar, ejektor rezinalar",
      },
      {
        companyId,
        code: "SUP-103",
        name: "Grafik Klishe Gravirovka",
        legalName: "Grafik Klishe Servis XK",
        category: "cliche_stamping" as const,
        tin: "307345678",
        contactPerson: "Rustam Aliyev",
        phone: "+998 97 789-01-23",
        email: "cliche@grafik.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Zarhal (Hot Foil) latun va kongrev magniy klishelari",
      },
      {
        companyId,
        code: "SUP-104",
        name: "Master Plate CTP Servis",
        legalName: "Master Plate CTP MCHJ",
        category: "ctp_prepress" as const,
        tin: "308456789",
        contactPerson: "Jamshid Karimov",
        phone: "+998 91 234-56-78",
        email: "master@plate.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Offset va Flexo polimer CTP formalar",
      },
      {
        companyId,
        code: "SUP-105",
        name: "Apex Die-Cutting Tools",
        legalName: "Apex Tooling MCHJ",
        category: "die_tooling" as const,
        tin: "309567890",
        contactPerson: "Sardor Mahmudov",
        phone: "+998 90 567-89-01",
        email: "order@apexdies.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Rotatsion magnit pichoqlar va tekis shtamplar",
      },
      {
        companyId,
        code: "SUP-106",
        name: "O'zbekiston Qog'oz Savdo",
        legalName: "O'zbekiston Qog'oz Savdo AJ",
        category: "raw_materials" as const,
        tin: "301678901",
        contactPerson: "Bahrom Saidov",
        phone: "+998 71 200-11-22",
        email: "sales@paper.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Bo'rli qog'oz, ofset qog'oz, karton, kraft",
      },
      {
        companyId,
        code: "SUP-107",
        name: "Sun Chemical Uzbekistan",
        legalName: "Sun Chemical Tashkent MCHJ",
        category: "cmyk_inks" as const,
        tin: "302789012",
        contactPerson: "Aziz Rahimov",
        phone: "+998 71 250-33-44",
        email: "inks@sunchem.uz",
        currency: "UZS",
        status: "Active" as const,
        notes: "Ofset va flexo bo'yoqlar, pantonelar, laklar",
      },
    ];

    try {
      await db.insert(suppliers).values(defaultSuppliers).onConflictDoNothing();
      raw = await db.query.suppliers.findMany({
        where: eq(suppliers.companyId, companyId),
        orderBy: [desc(suppliers.createdAt)],
      });
    } catch (seedErr) {
      console.warn("Suppliers auto-seed fallback:", seedErr);
    }
  }

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
    openingBalance: Number(s.openingBalance) || 0,
    currentBalance: Number(s.currentBalance) || 0,
    currency: s.currency || "UZS",
    paymentTerms: s.paymentTerms || "",
    address: s.address || "",
    notes: s.notes || "",
    logoUrl: s.logoUrl || undefined,
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
    openingBalance: Number(s.openingBalance) || 0,
    currentBalance: Number(s.currentBalance) || 0,
    currency: s.currency || "UZS",
    paymentTerms: s.paymentTerms || "",
    address: s.address || "",
    notes: s.notes || "",
    logoUrl: s.logoUrl || undefined,
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
        openingBalance: data.openingBalance !== undefined ? data.openingBalance.toString() : existing.openingBalance,
        currentBalance: data.currentBalance !== undefined ? data.currentBalance.toString() : existing.currentBalance,
        currency: data.currency || existing.currency,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : existing.paymentTerms,
        address: data.address !== undefined ? data.address : existing.address,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : existing.logoUrl,
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
        openingBalance: (data.openingBalance || 0).toString(),
        currentBalance: (data.currentBalance || 0).toString(),
        currency: data.currency || "UZS",
        paymentTerms: data.paymentTerms || null,
        address: data.address || null,
        notes: data.notes || null,
        logoUrl: data.logoUrl || null,
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
    fileUrl: o.fileUrl || undefined,
    fileName: o.fileName || undefined,
    telegramChatId: o.telegramChatId || undefined,
    telegramMessageId: o.telegramMessageId || undefined,
    telegramSentAt: o.telegramSentAt?.toISOString() || undefined,
    telegramConfirmedBy: o.telegramConfirmedBy || undefined,
    createdAt: o.createdAt.toISOString(),
  }));
}

export async function getAllToolingOrders(
  companyCode: string = "PRINTGOO"
): Promise<ToolingOrderRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawSuppliers = await getSuppliers(companyCode);
  const suppMap = new Map(rawSuppliers.map((s) => [s.id, s]));

  let raw = await db.query.supplierOrders.findMany({
    where: eq(supplierOrders.companyId, companyId),
    with: {
      supplier: true,
      workOrder: true,
    },
    orderBy: [desc(supplierOrders.orderDate), desc(supplierOrders.createdAt)],
  });

  if (raw.length === 0) {
    const ctpSupp = rawSuppliers.find((s) => s.category === "ctp_prepress") || rawSuppliers[0];
    const dieSupp = rawSuppliers.find((s) => s.category === "die_tooling") || rawSuppliers[1] || rawSuppliers[0];
    const clicheSupp = rawSuppliers.find((s) => s.category === "cliche_stamping") || rawSuppliers[2] || rawSuppliers[0];

    const todayStr = new Date().toISOString().split("T")[0];

    const seedOrders: Array<Partial<SupplierOrderRecord>> = [
      {
        supplierId: ctpSupp?.id || "",
        orderNo: "PO-2026-0041",
        orderDate: todayStr,
        deliveryDeadline: todayStr,
        orderType: "ctp_plates",
        title: "4 ta CTP Forma (CMYK) — Choy qutisi 250g",
        workOrderNo: "WO-2026-084",
        quantity: 4,
        unit: "dona",
        amount: 280000,
        currency: "UZS",
        status: "In_Production",
        specDetails: "Format: 745x605mm, 0.30mm termal plita, 2400 DPI",
        notes: "Bugun 15:00 gacha yetkazilishi shart (smena kutmoqda)",
      },
      {
        supplierId: dieSupp?.id || "",
        orderNo: "PO-2026-0042",
        orderDate: todayStr,
        deliveryDeadline: todayStr,
        orderType: "die_tooling",
        title: "Lazer kesish shtansformasi — Dori qutisi",
        workOrderNo: "WO-2026-085",
        quantity: 1,
        unit: "kompl",
        amount: 1450000,
        currency: "UZS",
        status: "Ordered",
        specDetails: "12-pozitsiyali avtomat Bobst, ejektor rezina, 23.8mm pichoq",
        notes: "Dieline chizmasi tasdiqlangan",
      },
      {
        supplierId: clicheSupp?.id || "",
        orderNo: "PO-2026-0043",
        orderDate: todayStr,
        deliveryDeadline: todayStr,
        orderType: "cliche",
        title: "Zarhal bosish (Hot Foil) latun klishe",
        workOrderNo: "WO-2026-086",
        quantity: 1,
        unit: "dona",
        amount: 620000,
        currency: "UZS",
        status: "Ready",
        specDetails: "Latun 7mm, 3D relyefli, 140x95mm logo",
        notes: "Prepress xonasida qabul qilishga tayyor",
      },
      {
        supplierId: clicheSupp?.id || "",
        orderNo: "PO-2026-0044",
        orderDate: todayStr,
        deliveryDeadline: todayStr,
        orderType: "cliche",
        title: "Kongrev bo'rtma klishe (Patriza bilan)",
        workOrderNo: "WO-2026-087",
        quantity: 1,
        unit: "kompl",
        amount: 480000,
        currency: "UZS",
        status: "Delivered",
        specDetails: "Magniy 4mm + kompozit patriza",
        notes: "Omborga qabul qilindi, qolip javoniga joylandi",
      },
      {
        supplierId: ctpSupp?.id || "",
        orderNo: "PO-2026-0045",
        orderDate: todayStr,
        deliveryDeadline: todayStr,
        orderType: "ctp_plates",
        title: "8 ta CTP Forma (Oldi-orqa 4+4) — Mahsulot katalogi",
        workOrderNo: "WO-2026-088",
        quantity: 8,
        unit: "dona",
        amount: 560000,
        currency: "UZS",
        status: "Ordered",
        specDetails: "Heidelberg SM-74 (605x745mm), 175 lpi",
        notes: "Ertaga ertalabki smenaga rejalashtirilgan",
      },
    ];

    if (ctpSupp?.id) {
      for (const item of seedOrders) {
        if (item.supplierId) {
          await upsertSupplierOrder(item, companyCode);
        }
      }
      raw = await db.query.supplierOrders.findMany({
        where: eq(supplierOrders.companyId, companyId),
        with: { supplier: true, workOrder: true },
        orderBy: [desc(supplierOrders.orderDate), desc(supplierOrders.createdAt)],
      });
    }
  }

  // Map any work orders by docNo for orders that only have workOrderNo string
  const allWos = await db.query.workOrders.findMany({
    where: eq(workOrders.companyId, companyId),
    columns: { id: true, docNo: true, photoUrl: true, photoUrls: true, productName: true },
  });
  const woByDocNo = new Map(allWos.map((w) => [w.docNo?.toLowerCase() || "", w]));
  const woById = new Map(allWos.map((w) => [w.id, w]));

  return raw.map((o) => {
    const supp = o.supplier || suppMap.get(o.supplierId);
    const wo =
      (o as any).workOrder ||
      (o.workOrderId ? woById.get(o.workOrderId) : null) ||
      (o.workOrderNo ? woByDocNo.get(o.workOrderNo.toLowerCase().trim()) : null);
    const woPhoto =
      wo?.photoUrl ||
      (Array.isArray(wo?.photoUrls) && wo.photoUrls.length > 0 ? wo.photoUrls[0] : undefined);

    return {
      id: o.id,
      supplierId: o.supplierId,
      supplierName: supp?.name || "Yetkazib beruvchi",
      supplierCode: supp?.code || "",
      supplierPhone: supp?.phone || "",
      orderNo: o.orderNo,
      orderDate: o.orderDate,
      deliveryDeadline: o.deliveryDeadline || undefined,
      orderType: o.orderType as any,
      title: o.title,
      workOrderId: o.workOrderId || wo?.id || undefined,
      workOrderNo: o.workOrderNo || wo?.docNo || undefined,
      imageUrl: woPhoto || undefined,
      workOrderProduct: (wo as any)?.productName || (wo as any)?.product || undefined,
      quantity: Number(o.quantity) || 1,
      unit: o.unit || "dona",
      amount: Number(o.amount) || 0,
      currency: o.currency || "UZS",
      status: o.status as any,
      specDetails: o.specDetails || undefined,
      notes: o.notes || undefined,
      fileUrl: o.fileUrl || undefined,
      fileName: o.fileName || undefined,
      telegramChatId: o.telegramChatId || undefined,
      telegramMessageId: o.telegramMessageId || undefined,
      telegramSentAt: o.telegramSentAt?.toISOString() || undefined,
      telegramConfirmedBy: o.telegramConfirmedBy || undefined,
      createdAt: o.createdAt.toISOString(),
    };
  });
}

export async function getNextSupplierOrderNo(companyId: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `PO-${currentYear}-`;

  const existingOrders = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      ilike(supplierOrders.orderNo, `${prefix}%`)
    ),
    columns: { orderNo: true },
  });

  let maxSeq = 0;
  for (const o of existingOrders) {
    if (o.orderNo) {
      const match = o.orderNo.match(new RegExp(`^PO-${currentYear}-(\\d+)$`, "i"));
      if (match) {
        const seq = parseInt(match[1], 10);
        if (seq > maxSeq) maxSeq = seq;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `PO-${currentYear}-${String(nextSeq).padStart(4, "0")}`;
}

export async function upsertSupplierOrder(
  data: Partial<SupplierOrderRecord>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let orderNo = data.orderNo?.trim();
  if (!orderNo) {
    orderNo = await getNextSupplierOrderNo(companyId);
  }

  const isUuid = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  let validWorkOrderId: string | null = null;
  if (isUuid(data.workOrderId)) {
    const woExists = await db.query.workOrders.findFirst({
      where: and(eq(workOrders.companyId, companyId), eq(workOrders.id, data.workOrderId!)),
    });
    if (woExists) {
      validWorkOrderId = data.workOrderId!;
    }
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
        workOrderId: data.workOrderId !== undefined ? validWorkOrderId : existing.workOrderId,
        workOrderNo: data.workOrderNo !== undefined ? data.workOrderNo : existing.workOrderNo,
        quantity: (data.quantity || 1).toString(),
        unit: data.unit || existing.unit,
        amount: (data.amount || 0).toString(),
        currency: data.currency || existing.currency,
        status: data.status || existing.status,
        specDetails: data.specDetails !== undefined ? data.specDetails : existing.specDetails,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        fileUrl: data.fileUrl !== undefined ? data.fileUrl : existing.fileUrl,
        fileName: data.fileName !== undefined ? data.fileName : existing.fileName,
        telegramChatId: data.telegramChatId !== undefined ? data.telegramChatId : existing.telegramChatId,
        telegramMessageId: data.telegramMessageId !== undefined ? data.telegramMessageId : existing.telegramMessageId,
        telegramSentAt: data.telegramSentAt ? new Date(data.telegramSentAt) : existing.telegramSentAt,
        telegramConfirmedBy: data.telegramConfirmedBy !== undefined ? data.telegramConfirmedBy : existing.telegramConfirmedBy,
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
        workOrderId: validWorkOrderId,
        workOrderNo: data.workOrderNo || null,
        quantity: (data.quantity || 1).toString(),
        unit: data.unit || "dona",
        amount: (data.amount || 0).toString(),
        currency: data.currency || "UZS",
        status: data.status || "Ordered",
        specDetails: data.specDetails || null,
        notes: data.notes || null,
        fileUrl: data.fileUrl || null,
        fileName: data.fileName || null,
        telegramChatId: data.telegramChatId || null,
        telegramMessageId: data.telegramMessageId || null,
        telegramSentAt: data.telegramSentAt ? new Date(data.telegramSentAt) : null,
        telegramConfirmedBy: data.telegramConfirmedBy || null,
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
  openingBalance: number;
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

  // Track order numbers so we don't duplicate warehouse receipts that correspond to these orders
  const orderNoSet = new Set(orders.map((o) => (o.orderNo || "").toLowerCase().trim()));

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

  // Ombor kirimlari: agar buyurtmada allaqachon hisoblanmagan bo'lsa
  for (const r of receipts) {
    const poNum = (r.poNumber || "").toLowerCase().trim();
    if (poNum && orderNoSet.has(poNum)) {
      // Alla qachon buyurtmalar qismida hisobga olingan, dublikat qilinmaydi!
      continue;
    }

    rawEntries.push({
      date: r.receiptDate.toISOString().split("T")[0],
      docNo: r.receiptNumber,
      docType: "Kirim / Xizmat",
      description: `Ombor kirimi${r.poNumber ? ` (PO: ${r.poNumber})` : ""}`,
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

  const openingBalance = Number(supp.openingBalance) || 0;
  let runningBalance = openingBalance;
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
    openingBalance,
    totalCredit,
    totalDebit,
    closingBalance: runningBalance,
  };
}

// ─── 5. Sync Supplier Balance ─────────────────────────────────────────────────

export async function syncSupplierBalance(companyId: string, supplierId: string) {
  const supp = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.companyId, companyId), eq(suppliers.id, supplierId)),
  });
  if (!supp) return;

  // Barcha buyurtmalar summasi (Credit)
  const orders = await db.query.supplierOrders.findMany({
    where: and(
      eq(supplierOrders.companyId, companyId),
      eq(supplierOrders.supplierId, supplierId),
      or(eq(supplierOrders.status, "Ready"), eq(supplierOrders.status, "Delivered"), eq(supplierOrders.status, "Ordered"))
    ),
  });

  const orderNoSet = new Set(orders.map((o) => (o.orderNo || "").toLowerCase().trim()));

  const receipts = await db.query.warehouseReceipts.findMany({
    where: and(
      eq(warehouseReceipts.companyId, companyId),
      or(
        eq(warehouseReceipts.supplierName, supp.name),
        eq(warehouseReceipts.supplierName, supp.legalName || "")
      )
    ),
  });

  let totalCredit = orders.reduce((sum, o) => sum + Number(o.amount), 0);
  for (const r of receipts) {
    const poNum = (r.poNumber || "").toLowerCase().trim();
    if (!poNum || !orderNoSet.has(poNum)) {
      totalCredit += Number(r.totalAmount) || 0;
    }
  }

  // Barcha to'lovlar summasi (Debit)
  const payments = await db.query.supplierPayments.findMany({
    where: and(
      eq(supplierPayments.companyId, companyId),
      eq(supplierPayments.supplierId, supplierId)
    ),
  });

  const totalDebit = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const openingBalance = Number(supp.openingBalance) || 0;
  const closingBalance = openingBalance + totalCredit - totalDebit;

  await db
    .update(suppliers)
    .set({
      currentBalance: closingBalance.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(suppliers.id, supplierId));
}

// ─── 6. Supplier Contracts (Haqiqiy Shartnomalar) ─────────────────────────────

export async function getSupplierContracts(
  supplierIdOrCode: string,
  companyCode: string = "PRINTGOO"
): Promise<SupplierContractRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const supp = await db.query.suppliers.findFirst({
    where: and(
      eq(suppliers.companyId, companyId),
      or(eq(suppliers.id, supplierIdOrCode), eq(suppliers.code, supplierIdOrCode))
    ),
  });

  if (!supp) return [];

  const raw = await db.query.supplierContracts.findMany({
    where: and(
      eq(supplierContracts.companyId, companyId),
      eq(supplierContracts.supplierId, supp.id)
    ),
    orderBy: [desc(supplierContracts.createdAt)],
  });

  return raw.map((c) => ({
    id: c.id,
    companyId: c.companyId,
    supplierId: c.supplierId,
    contractNo: c.contractNo,
    title: c.title,
    type: c.type as any,
    startDate: c.startDate,
    endDate: c.endDate || undefined,
    status: c.status as any,
    paymentTerms: c.paymentTerms || undefined,
    currency: c.currency,
    attachmentName: c.attachmentName || undefined,
    attachmentUrl: c.attachmentUrl || undefined,
    attachmentSize: c.attachmentSize || undefined,
    notes: c.notes || undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
}

export async function upsertSupplierContract(
  data: Partial<SupplierContractRecord>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let existing = null;
  if (data.id && !data.id.startsWith("cont-") && !data.id.startsWith("draft-")) {
    existing = await db.query.supplierContracts.findFirst({
      where: and(
        eq(supplierContracts.companyId, companyId),
        eq(supplierContracts.id, data.id)
      ),
    });
  }

  if (existing) {
    const [updated] = await db
      .update(supplierContracts)
      .set({
        contractNo: data.contractNo || existing.contractNo,
        title: data.title || existing.title,
        type: data.type || existing.type,
        startDate: data.startDate || existing.startDate,
        endDate: data.endDate !== undefined ? data.endDate : existing.endDate,
        status: data.status || existing.status,
        paymentTerms: data.paymentTerms !== undefined ? data.paymentTerms : existing.paymentTerms,
        currency: data.currency || existing.currency,
        attachmentName: data.attachmentName !== undefined ? data.attachmentName : existing.attachmentName,
        attachmentUrl: data.attachmentUrl !== undefined ? data.attachmentUrl : existing.attachmentUrl,
        attachmentSize: data.attachmentSize !== undefined ? data.attachmentSize : existing.attachmentSize,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(supplierContracts.id, existing.id))
      .returning();

    return { success: true, contract: updated };
  } else {
    const [created] = await db
      .insert(supplierContracts)
      .values({
        companyId,
        supplierId: data.supplierId!,
        contractNo: data.contractNo || `SH-${Date.now().toString().slice(-6)}`,
        title: data.title || "Yetkazib berish shartnomasi",
        type: data.type || "annual",
        startDate: data.startDate || new Date().toISOString().split("T")[0],
        endDate: data.endDate || null,
        status: data.status || "active",
        paymentTerms: data.paymentTerms || null,
        currency: data.currency || "UZS",
        attachmentName: data.attachmentName || null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentSize: data.attachmentSize || null,
        notes: data.notes || null,
      })
      .returning();

    return { success: true, contract: created };
  }
}

export async function deleteSupplierContract(
  contractId: string,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  await db
    .delete(supplierContracts)
    .where(
      and(
        eq(supplierContracts.companyId, companyId),
        eq(supplierContracts.id, contractId)
      )
    );

  return { success: true };
}
