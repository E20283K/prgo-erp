import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getCompanyIdByCode } from "@/lib/server/crmService";
import { createPayout, listPayouts, todayIso } from "@/lib/server/employeePayoutService";
import type { PayoutKind, PayoutMethod } from "@/components/documents/hr/types";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json(
    { success: false, error: error instanceof Error ? error.message : "Xatolik" },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["hr", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const kind = searchParams.get("kind");
    const data = await listPayouts({
      companyCode: searchParams.get("company") ?? "PRINTGOO",
      period: searchParams.get("period") || undefined,
      employeeId: searchParams.get("employeeId") || undefined,
      kind: kind === "advance" || kind === "settlement" ? kind : undefined,
    });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return errorResponse(error, 500);
  }
}

/** Records an advance or raschot handed to an employee. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["hr", "create"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as {
      employeeId?: string;
      amount?: number;
      kind?: PayoutKind;
      advanceDate?: string;
      period?: string;
      paymentMethod?: PayoutMethod;
      accountId?: string | null;
      note?: string;
    };
    if (!body.employeeId) throw new Error("Hodim tanlanmagan");
    const companyId = await getCompanyIdByCode(searchParams.get("company") ?? "PRINTGOO");
    const result = await createPayout({
      companyId,
      employeeId: body.employeeId,
      amount: Number(body.amount),
      kind: body.kind === "settlement" ? "settlement" : "advance",
      advanceDate: body.advanceDate || todayIso(),
      period: body.period || undefined,
      paymentMethod: body.paymentMethod === "card" ? "card" : "cash",
      accountId: body.accountId || null,
      note: body.note ?? null,
      source: "ui",
      createdByUserId: auth.user.id,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return errorResponse(error);
  }
}
