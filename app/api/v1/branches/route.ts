import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { branches } from "@/db/schema";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const companyId = await getCompanyIdByCode(companyCode);

    const list = await db.query.branches.findMany({
      where: eq(branches.companyId, companyId),
      orderBy: [asc(branches.name)],
    });

    const data = list.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      shortName: b.shortName,
      branchType: b.branchType,
      address: b.address,
      isMain: b.isMain,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
