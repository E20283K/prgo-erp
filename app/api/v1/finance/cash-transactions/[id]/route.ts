import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { reverseManualCashEntry } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../../_shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** `{ action: "reverse", reason? }`: journal rows are never deleted, only reversed. */
export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["finance", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string };
    if (body.action !== "reverse") throw new Error("Noma'lum amal");
    await reverseManualCashEntry(await companyIdFrom(request.url), id, auth.user.id, body.reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    return financeError(error);
  }
}
