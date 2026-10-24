import { NextRequest, NextResponse } from "next/server";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { getWorkOrderAuditHistory } from "@/lib/server/workOrderAuditService";
import { db } from "@/db";
import { workOrders } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const companyId = await getCompanyIdByCode(companyCode);

    // Agar id UUID bo'lsa, unga tegishli docNo ni topamiz
    let docNo = id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    if (isUuid) {
      const wo = await db.query.workOrders.findFirst({
        where: eq(workOrders.id, id),
        columns: { docNo: true },
      });
      if (wo?.docNo) {
        docNo = wo.docNo;
      }
    }

    const history = await getWorkOrderAuditHistory(companyId, docNo);

    return NextResponse.json({
      success: true,
      data: history,
      total: history.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tarixni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
