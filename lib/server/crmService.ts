import { db } from "@/db";
import { clients, clientContacts, clientContracts, companies } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getNextCustomerCode } from "./numberingService";
import type {
  CrmCustomerRecord,
  CustomerContactPerson,
  CustomerContractRecord,
} from "@/store/workspaceStore";

/**
 * Korxona kodi bo'yicha korxona ID sini topish (default: PRINTGOO)
 */
export async function getCompanyIdByCode(code: string = "PRINTGOO"): Promise<string> {
  const comp = await db.query.companies.findFirst({
    where: eq(companies.code, code),
  });
  if (!comp) {
    // Agar topilmasa, birinchi korxonani olish
    const firstComp = await db.query.companies.findFirst();
    if (!firstComp) throw new Error("Tizimda korxona (Company) topilmadi!");
    return firstComp.id;
  }
  return comp.id;
}

/**
 * Bazadan barcha real mijozlarni kontaktlari va shartnomalari bilan yuklash
 */
export async function getCrmClients(companyCode: string = "PRINTGOO"): Promise<CrmCustomerRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawClients = await db.query.clients.findMany({
    where: eq(clients.companyId, companyId),
    with: {
      contacts: true,
      contracts: true,
    },
    orderBy: [desc(clients.createdAt)],
  });

  return rawClients.map((c) => ({
    id: c.code || c.id,
    name: c.name,
    tin: c.tin || "",
    industry: c.industry || "Boshqa",
    contactPerson: c.contactPerson || "",
    phone: c.phone || "",
    email: c.email || "",
    contractNo: c.contractNo || "",
    paymentTerms: c.paymentTerms || "",
    manager: c.managerName || "",
    status: (c.status as CrmCustomerRecord["status"]) || "New",
    currency: (c.currency as "UZS" | "USD") || "UZS",
    legalAddress: c.legalAddress || undefined,
    deliveryAddress: c.deliveryAddress || undefined,
    bankName: c.bankName || undefined,
    bankAccount: c.bankAccount || undefined,
    mfo: c.mfo || undefined,
    oked: c.oked || undefined,
    vatPayer: c.vatPayer ?? false,
    vatNumber: c.vatNumber || undefined,
    creditLimitUsd: Number(c.creditLimitUsd) || 0,
    contractDate: c.contractDate || undefined,
    contractExpiry: c.contractExpiry || undefined,
    notes: c.notes || undefined,
    receivingHours: c.receivingHours || undefined,
    requiresPowerOfAttorney: c.requiresPowerOfAttorney ?? true,
    deliveryTransportNote: c.deliveryTransportNote || undefined,
    specialRequirements: c.specialRequirements || undefined,
    contacts: c.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      role: (contact.role as any) || "other",
      roleLabel: contact.roleLabel || "Xodim",
      phone: contact.phone || "",
      email: contact.email || undefined,
      telegram: contact.telegram || undefined,
      isPrimary: contact.isPrimary,
      notes: contact.notes || undefined,
    })),
    contracts: c.contracts.map((cnt) => ({
      id: cnt.id,
      contractNo: cnt.contractNo,
      title: cnt.title,
      type: (cnt.type as any) || "annual",
      startDate: cnt.startDate,
      endDate: cnt.endDate || cnt.startDate,
      status: (cnt.status as any) || "active",
      isDefault: cnt.isDefault,
      paymentTerms: cnt.paymentTerms || undefined,
      notes: cnt.notes || undefined,
    })),
  }));
}

/**
 * Yangi mijoz yaratish yoki mavjudini to'liq yangilash (Upsert)
 */
export async function upsertCrmClient(
  data: Partial<CrmCustomerRecord>,
  companyCode: string = "PRINTGOO"
): Promise<{ success: boolean; client: CrmCustomerRecord }> {
  const companyId = await getCompanyIdByCode(companyCode);

  if (!data.name || data.name.trim().length === 0) {
    throw new Error("Mijoz nomi kiritilishi shart!");
  }

  // Mavjud mijozni tekshirish (id, code yoki name bo'yicha)
  const isUuid = data.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);
  const existingClient = await db.query.clients.findFirst({
    where: (t, { and, eq, or }) => {
      const matchers = [eq(t.name, data.name!.trim())];
      if (isUuid) matchers.push(eq(t.id, data.id!));
      if (data.id && data.id.startsWith("CUST-")) matchers.push(eq(t.code, data.id));
      return and(eq(t.companyId, companyId), or(...matchers));
    },
  });

  let code = existingClient?.code;
  if (!code) {
    const rawId = (data.id || "").trim();
    const isDraft = !rawId || rawId.startsWith("draft-") || rawId.startsWith("tab-") || rawId.startsWith("new-") || rawId.includes("Qoralama") || rawId.includes("Yangi") || rawId.startsWith("CUST-NEW-");
    code = isDraft ? await getNextCustomerCode(companyCode) : rawId;
  }

  let clientId: string;

  const clientPayload = {
    companyId,
    code,
    name: data.name,
    legalName: data.name,
    tin: data.tin || null,
    vatNumber: data.vatNumber || null,
    vatPayer: data.vatPayer ?? false,
    industry: data.industry || "General",
    phone: data.phone || null,
    email: data.email || null,
    bankName: data.bankName || null,
    bankAccount: data.bankAccount || null,
    mfo: data.mfo || null,
    oked: data.oked || null,
    legalAddress: data.legalAddress || null,
    deliveryAddress: data.deliveryAddress || null,
    currency: data.currency || "UZS",
    status: (data.status as any) || "New",
    creditLimitUsd: String(data.creditLimitUsd ?? 0),
    paymentTerms: data.paymentTerms || null,
    managerName: data.manager || null,
    contactPerson: data.contactPerson || null,
    receivingHours: data.receivingHours || null,
    requiresPowerOfAttorney: data.requiresPowerOfAttorney ?? true,
    deliveryTransportNote: data.deliveryTransportNote || null,
    specialRequirements: data.specialRequirements || null,
    notes: data.notes || null,
    contractNo: data.contractNo || null,
    contractDate: data.contractDate || null,
    contractExpiry: data.contractExpiry || null,
    updatedAt: new Date(),
  };

  if (existingClient) {
    clientId = existingClient.id;
    await db
      .update(clients)
      .set(clientPayload)
      .where(eq(clients.id, clientId));
  } else {
    const [inserted] = await db
      .insert(clients)
      .values(clientPayload)
      .returning({ id: clients.id });
    clientId = inserted.id;
  }

  // Kontaktlarni sinxronlash (mavjudlarini yangilash/qayta yozish)
  if (data.contacts && Array.isArray(data.contacts)) {
    await db.delete(clientContacts).where(eq(clientContacts.clientId, clientId));
    if (data.contacts.length > 0) {
      await db.insert(clientContacts).values(
        data.contacts.map((contact) => ({
          clientId,
          name: contact.name,
          role: contact.role || "other",
          roleLabel: contact.roleLabel || null,
          phone: contact.phone || null,
          email: contact.email || null,
          telegram: contact.telegram || null,
          isPrimary: contact.isPrimary ?? false,
          notes: contact.notes || null,
        }))
      );
    }
  }

  // Shartnomalarni sinxronlash
  if (data.contracts && Array.isArray(data.contracts)) {
    await db.delete(clientContracts).where(eq(clientContracts.clientId, clientId));
    if (data.contracts.length > 0) {
      await db.insert(clientContracts).values(
        data.contracts.map((cnt) => ({
          clientId,
          contractNo: cnt.contractNo || `CON-${Date.now().toString().slice(-4)}`,
          title: cnt.title || "Yetkazib berish shartnomasi",
          type: (cnt.type as any) || "annual",
          startDate: cnt.startDate || new Date().toISOString().split("T")[0],
          endDate: cnt.endDate || null,
          status: (cnt.status as any) || "active",
          isDefault: cnt.isDefault ?? false,
          paymentTerms: cnt.paymentTerms || null,
          notes: cnt.notes || null,
        }))
      );
    }
  }

  // Yangilangan natijani qaytarish
  const [updatedRecord] = await getCrmClients(companyCode);
  return {
    success: true,
    client: updatedRecord,
  };
}
