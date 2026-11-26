import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { saveCashCategory, type CashCategoryInput } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../../_shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  const auth = await requireApiUser(request, [["finance", "edit"]]);
  if ("response" in auth) return auth.response;
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as CashCategoryInput;
    await saveCashCategory(await companyIdFrom(request.url), { ...body, id });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return financeError(error);
  }
}
