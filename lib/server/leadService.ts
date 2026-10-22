import { db } from "@/db";
import { crmLeads, clients } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getCompanyIdByCode } from "./crmService";
import type { LeadRecord } from "@/components/crm/LeadDetailModal";

export async function getCrmLeads(companyCode: string = "PRINTGOO"): Promise<LeadRecord[]> {
  const companyId = await getCompanyIdByCode(companyCode);

  const rawLeads = await db.query.crmLeads.findMany({
    where: eq(crmLeads.companyId, companyId),
    orderBy: [desc(crmLeads.createdAt)],
  });

  return rawLeads.map((l) => ({
    id: l.leadNo || l.id,
    company: l.company,
    tin: l.tin || "",
    contact: l.contact || "",
    phone: l.phone || "",
    email: l.email || "",
    productInterest: l.productInterest || "",
    estimatedOrderUsd: Number(l.estimatedOrderUsd) || 0,
    source: l.source || "",
    manager: l.managerName || "",
    notes: l.notes || "",
    status: l.status,
  }));
}

export async function upsertCrmLead(
  data: Partial<LeadRecord>,
  companyCode: string = "PRINTGOO"
) {
  const companyId = await getCompanyIdByCode(companyCode);

  let leadNo = data.id?.startsWith("LD-") ? data.id : null;
  if (!leadNo) {
    const count = await db.$count(crmLeads, eq(crmLeads.companyId, companyId));
    leadNo = `LD-${1000 + count + 1}`;
  }

  const existing = await db.query.crmLeads.findFirst({
    where: and(eq(crmLeads.companyId, companyId), eq(crmLeads.leadNo, leadNo)),
  });

  if (existing) {
    const [updated] = await db
      .update(crmLeads)
      .set({
        company: data.company || existing.company,
        tin: data.tin !== undefined ? data.tin : existing.tin,
        contact: data.contact !== undefined ? data.contact : existing.contact,
        phone: data.phone !== undefined ? data.phone : existing.phone,
        email: data.email !== undefined ? data.email : existing.email,
        productInterest: data.productInterest !== undefined ? data.productInterest : existing.productInterest,
        estimatedOrderUsd: (data.estimatedOrderUsd || 0).toString(),
        source: data.source !== undefined ? data.source : existing.source,
        managerName: data.manager !== undefined ? data.manager : existing.managerName,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        status: data.status || existing.status,
        updatedAt: new Date(),
      })
      .where(eq(crmLeads.id, existing.id))
      .returning();

    return { success: true, lead: updated };
  } else {
    const [created] = await db
      .insert(crmLeads)
      .values({
        companyId,
        leadNo,
        company: data.company || "Noma'lum Korxona",
        tin: data.tin || null,
        contact: data.contact || null,
        phone: data.phone || null,
        email: data.email || null,
        productInterest: data.productInterest || null,
        estimatedOrderUsd: (data.estimatedOrderUsd || 0).toString(),
        source: data.source || null,
        managerName: data.manager || null,
        notes: data.notes || null,
        status: data.status || "New",
      })
      .returning();

    return { success: true, lead: created };
  }
}

export async function deleteCrmLead(leadNoOrId: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const existing = await db.query.crmLeads.findFirst({
    where: and(
      eq(crmLeads.companyId, companyId),
      eq(crmLeads.leadNo, leadNoOrId)
    ),
  });

  if (existing) {
    await db.delete(crmLeads).where(eq(crmLeads.id, existing.id));
    return { success: true };
  }

  // fallback to id
  await db.delete(crmLeads).where(eq(crmLeads.id, leadNoOrId));
  return { success: true };
}
