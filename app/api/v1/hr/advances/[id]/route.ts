import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { cancelPayout } from "@/lib/server/employeePayoutService";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** `{ action: "cancel", reason? }` — payouts are never deleted, only cancelled. */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["hr", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
    if (body.action !== "cancel") throw new Error("Noma'lum amal");
    const companyId = await getCompanyIdByCode(searchParams.get("company") ?? "PRINTGOO");
    await cancelPayout(companyId, id, auth.user.id, body.reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
