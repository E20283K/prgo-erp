import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getCashFlowReport } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const year = Number(new URL(request.url).searchParams.get("year")) || new Date().getFullYear();
    const data = await getCashFlowReport(await companyIdFrom(request.url), year);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return financeError(error, 500);
  }
}
