import { NextRequest, NextResponse } from "next/server";
import { getCrmClients, upsertCrmClient } from "@/lib/server/crmService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const clients = await getCrmClients(companyCode);
    return NextResponse.json({
      success: true,
      data: clients,
      total: clients.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Mijozlarni yuklashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || searchParams.get("companyCode") || "PRINTGOO";

    const result = await upsertCrmClient(body, companyCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Mijozni saqlashda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
