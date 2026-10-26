import { NextRequest, NextResponse } from "next/server";
import { getCrmIndustries, getOrCreateCrmIndustry } from "@/lib/server/crmService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const industries = await getCrmIndustries();
    return NextResponse.json({
      success: true,
      data: industries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sohalarni yuklashda xatolik yuz berdi",
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

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { success: false, error: "Soha nomi kiritilishi shart" },
        { status: 400 }
      );
    }

    const industry = await getOrCreateCrmIndustry(body.name, companyCode);
    return NextResponse.json({
      success: true,
      data: industry,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sohani qo'shishda xatolik yuz berdi",
      },
      { status: 500 }
    );
  }
}
