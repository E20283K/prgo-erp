import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { listCashCategories, saveCashCategory, type CashCategoryInput } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const data = await listCashCategories(await companyIdFrom(request.url));
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return financeError(error, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "create"]]);
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as CashCategoryInput;
    const id = await saveCashCategory(await companyIdFrom(request.url), { ...body, id: undefined });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return financeError(error);
  }
}
