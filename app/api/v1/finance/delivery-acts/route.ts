import { NextRequest, NextResponse } from "next/server";
import { getDeliveryActs, upsertDeliveryAct } from "@/lib/server/financeService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const acts = await getDeliveryActs(companyCode);
    return NextResponse.json({
      success: true,
      data: acts,
      total: acts.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Dalolatlarni yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const result = await upsertDeliveryAct(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Dalolatni saqlashda xatolik",
      },
      { status: 500 }
    );
  }
}
