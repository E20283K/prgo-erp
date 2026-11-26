import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { listMoneyAccounts, saveMoneyAccount, type MoneyAccountInput } from "@/lib/server/treasuryService";
import { companyIdFrom, financeError } from "../_shared";

export const dynamic = "force-dynamic";

/** Money accounts with balances. Payout and payment forms in HR and CRM pick from it too. */
export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, [
    ["finance", "view"],
    ["hr", "view"],
    ["crm", "view"],
    ["production", "view"],
  ]);
  if ("response" in auth) return auth.response;
  try {
    const accounts = await listMoneyAccounts(await companyIdFrom(request.url));
    return NextResponse.json({ success: true, data: accounts, total: accounts.length });
  } catch (error) {
    return financeError(error, 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, [["finance", "create"]]);
  if ("response" in auth) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as MoneyAccountInput;
    const id = await saveMoneyAccount(await companyIdFrom(request.url), { ...body, id: undefined });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    return financeError(error);
  }
}
