import { NextRequest, NextResponse } from "next/server";
import { getNextWorkOrderNoFromDb } from "@/lib/server/workOrderService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") ?? "PRINTGOO";
    const department = searchParams.get("department") ?? "Offset";

    const nextNo = await getNextWorkOrderNoFromDb(companyCode, department);
    return NextResponse.json({
      success: true,
      data: {
        nextNo,
        department,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Navbatdagi raqamni hisoblashda xatolik",
      },
      { status: 500 }
    );
  }
}
