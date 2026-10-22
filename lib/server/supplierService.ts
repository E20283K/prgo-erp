import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
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

  // Mavjud ta'minotchi bormi (id yoki code bo'yicha)?
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

  // fallback by code
  await db.delete(suppliers).where(
    and(eq(suppliers.companyId, companyId), eq(suppliers.code, idOrCode))
  );
  return { success: true };
}
