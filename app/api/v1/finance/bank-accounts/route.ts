import { NextRequest, NextResponse } from "next/server";
import { getBankAccounts } from "@/lib/server/financeService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyCode = searchParams.get("company") || "PRINTGOO";

    const accounts = await getBankAccounts(companyCode);
    return NextResponse.json({
      success: true,
      data: accounts,
      total: accounts.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bank hisoblarini yuklashda xatolik",
      },
      { status: 500 }
    );
  }
}
