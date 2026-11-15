import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, type PermissionRule } from "@/lib/server/apiAuth";
import { createProductType, getProductTypes } from "@/lib/server/productTypeService";

export const dynamic = "force-dynamic";

const READ: PermissionRule[] = [
  ["production", "view"],
  ["finance", "view"],
];
const WRITE: PermissionRule[] = [
  ["production", "create"],
  ["production", "edit"],
];

export async function GET(request: NextRequest) {
  const auth = await requireApiUser(request, READ);
  if ("response" in auth) return auth.response;
  try {
    const companyCode = new URL(request.url).searchParams.get("company") || "PRINTGOO";
    const data = await getProductTypes(companyCode);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/v1/master/product-types error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Mahsulot turlarini yuklashda xatolik" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, WRITE);
  if ("response" in auth) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const companyCode = new URL(request.url).searchParams.get("company") || "PRINTGOO";
    const data = await createProductType(String(body?.name ?? ""), companyCode);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mahsulot turini saqlashda xatolik";
    const isInput = message.startsWith("Tur nomi");
    if (!isInput) console.error("POST /api/v1/master/product-types error:", error);
    return NextResponse.json({ success: false, error: message }, { status: isInput ? 400 : 500 });
  }
}
