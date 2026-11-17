import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getEmployeeLedger } from "@/lib/server/employeePayoutService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["hr", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const data = await getEmployeeLedger(id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
