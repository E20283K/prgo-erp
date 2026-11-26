import { NextRequest, NextResponse } from "next/server";
import { hasAny, requireApiUser, type PermissionRule } from "@/lib/server/apiAuth";
import { createFinishingOption, getFinishingOptions } from "@/lib/server/finishingOptionService";

export const dynamic = "force-dynamic";

const READ: PermissionRule[] = [
  ["production", "view"],
  ["finance", "view"],
  // Qog'oz turlari ombor pasportida ham tanlanadi
  ["warehouse", "view"],
];
const WRITE: PermissionRule[] = [
  ["production", "create"],
  ["production", "edit"],
];
// Ombor xodimi faqat qog'oz turini qo'sha oladi
const PAPER_TYPE_WRITE: PermissionRule[] = [
  ...WRITE,
  ["warehouse", "create"],
  ["warehouse", "edit"],
];

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, READ);
  if ("response" in auth) return auth.response;
  try {
    const companyCode = new URL(request.url).searchParams.get("company") || "PRINTGOO";
    const data = await getFinishingOptions(companyCode);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/v1/master/finishing-options error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Pardoz turlarini yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, PAPER_TYPE_WRITE);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.kind !== "paper_type" && !hasAny(auth.user, WRITE)) {
      return NextResponse.json({ success: false, error: "Bu amal uchun ruxsatingiz yo'q." }, { status: 403 });
    }
    const companyCode = new URL(request.url).searchParams.get("company") || "PRINTGOO";
    const data = await createFinishingOption(body?.kind, String(body?.name ?? ""), companyCode);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pardoz turini saqlashda xatolik";
    const isInput = message.startsWith("Tur nomi");
    if (!isInput) console.error("POST /api/v1/master/finishing-options error:", error);
    return NextResponse.json({ success: false, error: message }, { status: isInput ? 400 : 500 });
  }
}
