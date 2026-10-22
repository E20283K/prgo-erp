import { NextRequest, NextResponse } from "next/server";
import { getNextCustomerCode } from "@/lib/server/numberingService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";

    const nextNo = await getNextCustomerCode(companyCode);
    return NextResponse.json({
      success: true,
      data: { nextNo },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi mijoz kodini hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
