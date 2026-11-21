import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { setPeriodApproval } from "@/lib/server/hrService";

export const dynamic = "force-dynamic";

/** Approves (locks) or reopens a payroll month. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["hr", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const body = (await request.json().catch(() => ({}))) as { period?: string; action?: string };
    if (!body.period) throw new Error("Davr ko'rsatilmagan");
    const action = body.action === "reopen" ? "reopen" : "approve";
    const result = await setPeriodApproval(body.period, action, searchParams.get("company") ?? "PRINTGOO");
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
