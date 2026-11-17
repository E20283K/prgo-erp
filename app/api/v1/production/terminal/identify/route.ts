import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { productionMachines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireApiUser } from "@/lib/server/apiAuth";
import { identifyOperator } from "@/lib/server/terminalIdentityService";

export const dynamic = "force-dynamic";

/** Shared kiosk: who is at the machine, by PIN or badge scan. Returns a short-lived operator token. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [
    ["production", "create"],
    ["production", "edit"],
  ]);
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { machineId?: string; code?: string };
    if (!body.machineId) throw new Error("Uskuna tanlanmagan.");
    const machine = await db.query.productionMachines.findFirst({
      where: eq(productionMachines.id, body.machineId),
      columns: { companyId: true },
    });
    if (!machine) throw new Error("Uskuna topilmadi.");
    const result = await identifyOperator(machine.companyId, body.code || "", auth.user.id);
    return NextResponse.json({
      success: true,
      operator: { employeeId: result.operator.employeeId, fullName: result.operator.fullName },
      token: result.token,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Operator aniqlanmadi" },
      { status: 400 }
    );
  }
}
