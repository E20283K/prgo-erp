import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import {
  createManualCashEntry,
  listCashTransactions,
  type ManualCashEntryInput,
} from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../_shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "view"]]);
  if ("response" in auth) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction");
    const data = await listCashTransactions(await companyIdFrom(request.url), {
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      accountId: searchParams.get("accountId") || undefined,
      categoryId: searchParams.get("categoryId") || undefined,
      direction: direction === "in" || direction === "out" ? direction : undefined,
    });
    return NextResponse.json({ success: true, data, total: data.length });
  } catch (error) {
    return financeError(error, 500);
  }
}

/** A movement entered by hand: an expense or other income. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "create"]]);
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as ManualCashEntryInput;
    const id = await createManualCashEntry(await companyIdFrom(request.url), body, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return financeError(error);
  }
}
