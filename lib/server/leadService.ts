import { db, type DbExec } from "@/db";
import { crmLeads, clients } from "@/db/schema";
import { eq, desc, and, or, ilike } from "drizzle-orm";
import { getCompanyIdByCode, resolveClient } from "./crmService";
import { calculateNextNumber, getCurrentYearSuffix, lockNumbering } from "./numberingService";
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
    // Highest number in use + 1: counting rows repeats a number once a lead has been deleted.
    const rows = await db
      .select({ leadNo: crmLeads.leadNo })
      .from(crmLeads)
      .where(and(eq(crmLeads.companyId, companyId), ilike(crmLeads.leadNo, "LD-%")));
    const max = rows.reduce((m, r) => Math.max(m, parseInt(r.leadNo.slice(3), 10) || 0), 1000);
    leadNo = `LD-${max + 1}`;
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
        estimatedOrderUsd:
          data.estimatedOrderUsd !== undefined ? (data.estimatedOrderUsd || 0).toString() : existing.estimatedOrderUsd,
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

/**
 * Lead → client. The lead is linked to the CRM client it became: an existing one with the same
 * TIN or name, otherwise a new client made from what the lead actually holds (nothing is invented).
 * Converting twice returns the same client.
 */
export async function convertLeadToClient(leadNoOrId: string, companyCode: string = "PRINTGOO", exec: DbExec = db) {
  const companyId = await getCompanyIdByCode(companyCode);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadNoOrId);

  return exec.transaction(async (tx) => {
    const lead = await tx.query.crmLeads.findFirst({
      where: and(
        eq(crmLeads.companyId, companyId),
        isUuid ? or(eq(crmLeads.id, leadNoOrId), eq(crmLeads.leadNo, leadNoOrId)) : eq(crmLeads.leadNo, leadNoOrId)
      ),
    });
    if (!lead) throw new Error(`${leadNoOrId} lidi topilmadi.`);
    if (!lead.company.trim()) throw new Error("Lidda korxona nomi kiritilmagan.");

    let client = await resolveClient(tx, companyId, { id: lead.convertedClientId, tin: lead.tin, name: lead.company });
    let created = false;
    if (!client) {
      await lockNumbering(tx, companyId, "CUST");
      const yearSuffix = getCurrentYearSuffix();
      const codes = await tx
        .select({ num: clients.code })
        .from(clients)
        .where(and(eq(clients.companyId, companyId), ilike(clients.code, `CUST-${yearSuffix}-%`)));
      [client] = await tx
        .insert(clients)
        .values({
          companyId,
          code: calculateNextNumber("CUST", codes.map((r) => r.num), yearSuffix),
          name: lead.company.trim(),
          tin: lead.tin?.trim() || null,
          phone: lead.phone || null,
          email: lead.email || null,
          contactPerson: lead.contact || null,
          managerName: lead.managerName || null,
        })
        .returning();
      created = true;
    }

    await tx
      .update(crmLeads)
      .set({ status: "Converted", convertedClientId: client.id, updatedAt: new Date() })
      .where(eq(crmLeads.id, lead.id));

    return {
      success: true,
      created,
      client: { id: client.id, code: client.code, name: client.name, tin: client.tin || "" },
      lead: { id: lead.leadNo, status: "Converted" as const },
    };
  });
}

export async function deleteCrmLead(leadNoOrId: string, companyCode: string = "PRINTGOO") {
  const companyId = await getCompanyIdByCode(companyCode);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadNoOrId);
  const existing = await db.query.crmLeads.findFirst({
    where: and(
      eq(crmLeads.companyId, companyId),
      isUuid ? or(eq(crmLeads.id, leadNoOrId), eq(crmLeads.leadNo, leadNoOrId)) : eq(crmLeads.leadNo, leadNoOrId)
    ),
  });
  if (!existing) throw new Error("Lid topilmadi");

  await db.delete(crmLeads).where(eq(crmLeads.id, existing.id));
  return { success: true };
}
