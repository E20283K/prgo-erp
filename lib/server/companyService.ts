import { db } from "@/db";
import { companies, branches, warehouses, tradingSales } from "@/db/schema";
import { eq, asc, sql } from "drizzle-orm";

export type CompanyLegalType = "MChJ" | "YTT" | "XK" | "AJ";

export interface CompanyRecord {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  legalType: CompanyLegalType;
  industryType?: "printing" | "textile";
  inn?: string;
  isVatPayer: boolean;
  vatNumber?: string;
  bankName?: string;
  bankAccount?: string;
  mfo?: string;
  annualLimitUzs: number;
  currentTurnoverUzs: number;
  baseCurrency: string;
  status: "Active" | "Inactive";
  branchesCount?: number;
  warehousesCount?: number;
  director?: string;
  accountant?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  settings?: any;
  createdAt?: string;
  updatedAt?: string;
}

export async function getCompanies(): Promise<CompanyRecord[]> {
  const rows = await db
    .select()
    .from(companies)
    .orderBy(asc(companies.code));

  const result: CompanyRecord[] = [];

  for (const r of rows) {
    // Branches count
    const bRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(branches)
      .where(eq(branches.companyId, r.id));
    const branchesCount = Number(bRes[0]?.count || 0);

    // Warehouses count
    const wRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(warehouses)
      .where(eq(warehouses.companyId, r.id));
    const warehousesCount = Number(wRes[0]?.count || 0);

    // Current turnover from trading sales
    let currentTurnoverUzs = 0;
    try {
      const salesRes = await db
        .select({ total: sql<string>`coalesce(sum(total_uzs), 0)` })
        .from(tradingSales)
        .where(eq(tradingSales.companyId, r.id));
      currentTurnoverUzs = Number(salesRes[0]?.total || 0);
    } catch (e) {}

    result.push({
      id: r.id,
      code: r.code,
      name: r.name,
      legalName: r.legalName || undefined,
      legalType: (r.legalType as CompanyLegalType) || "MChJ",
      industryType: r.industryType as any,
      inn: r.inn || undefined,
      isVatPayer: Boolean(r.isVatPayer),
      vatNumber: r.vatNumber || undefined,
      bankName: r.bankName || undefined,
      bankAccount: r.bankAccount || undefined,
      mfo: r.mfo || undefined,
      annualLimitUzs: Number(r.annualLimitUzs) || 1_000_000_000,
      currentTurnoverUzs,
      baseCurrency: r.baseCurrency || "UZS",
      status: (r.status as "Active" | "Inactive") || "Active",
      branchesCount,
      warehousesCount,
      director: (r.settings as any)?.director || undefined,
      accountant: (r.settings as any)?.accountant || undefined,
      phone: (r.settings as any)?.phone || undefined,
      email: (r.settings as any)?.email || undefined,
      address: (r.settings as any)?.address || undefined,
      notes: r.notes || undefined,
      settings: r.settings || {},
      createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
    });
  }

  return result;
}

export async function upsertCompany(payload: Partial<CompanyRecord>): Promise<CompanyRecord> {
  const code = (payload.code || `COMP-${Date.now().toString().slice(-4)}`).toUpperCase();
  const name = payload.name || "Yangi Kompaniya";
  const legalType = payload.legalType || "MChJ";

  const values: any = {
    code,
    name,
    legalName: payload.legalName || name,
    legalType,
    inn: payload.inn || null,
    isVatPayer: payload.isVatPayer !== undefined ? Boolean(payload.isVatPayer) : legalType === "MChJ",
    vatNumber: payload.vatNumber || null,
    bankName: payload.bankName || null,
    bankAccount: payload.bankAccount || null,
    mfo: payload.mfo || null,
    annualLimitUzs: payload.annualLimitUzs !== undefined ? String(payload.annualLimitUzs) : (legalType === "YTT" ? "1000000000.00" : "0.00"),
    baseCurrency: payload.baseCurrency || "UZS",
    status: payload.status || "Active",
    notes: payload.notes || null,
    settings: {
      ...((payload.settings as any) || {}),
      director: payload.director,
      accountant: payload.accountant,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
    },
    updatedAt: new Date(),
  };

  let record;
  if (payload.id && !payload.id.startsWith("new-") && !payload.id.startsWith("draft-")) {
    const [updated] = await db
      .update(companies)
      .set(values)
      .where(eq(companies.id, payload.id))
      .returning();
    record = updated;
  } else {
    const [created] = await db
      .insert(companies)
      .values({
        ...values,
        industryType: payload.industryType || "printing",
      })
      .returning();
    record = created;
  }

  return {
    id: record.id,
    code: record.code,
    name: record.name,
    legalName: record.legalName || undefined,
    legalType: (record.legalType as CompanyLegalType) || "MChJ",
    industryType: record.industryType as any,
    inn: record.inn || undefined,
    isVatPayer: Boolean(record.isVatPayer),
    vatNumber: record.vatNumber || undefined,
    bankName: record.bankName || undefined,
    bankAccount: record.bankAccount || undefined,
    mfo: record.mfo || undefined,
    annualLimitUzs: Number(record.annualLimitUzs) || 1_000_000_000,
    currentTurnoverUzs: 0,
    baseCurrency: record.baseCurrency,
    status: record.status as any,
    director: (record.settings as any)?.director || undefined,
    accountant: (record.settings as any)?.accountant || undefined,
    phone: (record.settings as any)?.phone || undefined,
    email: (record.settings as any)?.email || undefined,
    address: (record.settings as any)?.address || undefined,
    notes: record.notes || undefined,
    settings: record.settings || {},
    createdAt: record.createdAt?.toISOString(),
    updatedAt: record.updatedAt?.toISOString(),
  };
}

export async function deleteCompany(id: string): Promise<boolean> {
  const bRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(branches)
    .where(eq(branches.companyId, id));
  if (Number(bRes[0]?.count || 0) > 0) {
    throw new Error("Kompaniyani o'chirib bo'lmaydi: unga biriktirilgan filiallar mavjud.");
  }

  const wRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(warehouses)
    .where(eq(warehouses.companyId, id));
  if (Number(wRes[0]?.count || 0) > 0) {
    throw new Error("Kompaniyani o'chirib bo'lmaydi: unga biriktirilgan omborlar mavjud.");
  }

  await db.delete(companies).where(eq(companies.id, id));
  return true;
}
