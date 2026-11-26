import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { getPnlReport } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const month = new Date().toISOString().slice(0, 7);
    const data = await getPnlReport(
      await companyIdFrom(request.url),
      searchParams.get("from") || month,
      searchParams.get("to") || month
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return financeError(error);
  }
}
