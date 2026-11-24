import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/apiAuth";
import { listTgOrders, type TgOrderScope } from "@/lib/server/tgOrdersService";
import { TG_ORDERS_RULES } from "../ordersRules";

export const dynamic = "force-dynamic";

const SCOPES = new Set<TgOrderScope>(["active", "done", "all"]);

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, TG_ORDERS_RULES);
  if ("response" in auth) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const scopeParam = params.get("scope") as TgOrderScope | null;
    const scope = scopeParam && SCOPES.has(scopeParam) ? scopeParam : "active";
    const data = await listTgOrders(auth.user.id, scope, params.get("q") ?? "");
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Xatolik" },
      { status: 400 }
    );
  }
}
